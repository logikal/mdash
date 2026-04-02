import { IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { Storage } from "./storage.js";

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

const FLUSH_INTERVAL_MS = 30_000;

interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<WebSocket>;
  flushTimer: ReturnType<typeof setInterval> | null;
  dirty: boolean;
  docId: string;
}

export class YjsServer {
  private wss: WebSocketServer;
  private rooms = new Map<string, Room>();
  private storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const docId = url.searchParams.get("doc");
      if (!docId) {
        ws.close(4000, "Missing doc parameter");
        return;
      }

      this.handleConnection(ws, docId);
    });
  }

  /** Handle an HTTP upgrade request (called from the Node http server). */
  handleUpgrade(req: IncomingMessage, socket: any, head: Buffer): void {
    // Only handle upgrades to /ws
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (!url.pathname.startsWith("/ws")) {
      socket.destroy();
      return;
    }

    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit("connection", ws, req);
    });
  }

  /** Get or create a Yjs room for the given document. */
  private getOrCreateRoom(docId: string): Room {
    let room = this.rooms.get(docId);
    if (room) return room;

    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);

    // Load existing content from storage into Y.Text
    const stored = this.storage.read(docId);
    if (stored && stored.content) {
      const ytext = doc.getText("codemirror");
      ytext.insert(0, stored.content);
    }

    room = {
      doc,
      awareness,
      clients: new Set(),
      flushTimer: null,
      dirty: false,
      docId,
    };

    // Listen for doc updates to mark room as dirty
    doc.on("update", () => {
      room!.dirty = true;
    });

    // Start periodic flush timer
    room.flushTimer = setInterval(() => {
      this.flushRoom(room!);
    }, FLUSH_INTERVAL_MS);

    this.rooms.set(docId, room);
    return room;
  }

  /** Handle a new WebSocket connection for a document room. */
  private handleConnection(ws: WebSocket, docId: string): void {
    const room = this.getOrCreateRoom(docId);
    room.clients.add(ws);

    // Send initial sync step 1
    {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.writeSyncStep1(encoder, room.doc);
      ws.send(encoding.toUint8Array(encoder));
    }

    // Send current awareness states
    const awarenessStates = awarenessProtocol.encodeAwarenessUpdate(
      room.awareness,
      Array.from(room.awareness.getStates().keys())
    );
    if (awarenessStates.length > 1) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_AWARENESS);
      encoding.writeVarUint8Array(encoder, awarenessStates);
      ws.send(encoding.toUint8Array(encoder));
    }

    // Handle awareness changes — broadcast to other clients
    const awarenessChangeHandler = (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      _origin: any
    ) => {
      const changedClients = added.concat(updated, removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, changedClients)
      );
      const msg = encoding.toUint8Array(encoder);
      for (const client of room.clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(msg);
        }
      }
    };
    room.awareness.on("update", awarenessChangeHandler);

    ws.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const buf = Array.isArray(data) ? Buffer.concat(data) : data;
        const message = new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer, buf instanceof ArrayBuffer ? 0 : buf.byteOffset, buf instanceof ArrayBuffer ? buf.byteLength : buf.byteLength);
        const decoder = decoding.createDecoder(message);
        const msgType = decoding.readVarUint(decoder);

        switch (msgType) {
          case MSG_SYNC: {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MSG_SYNC);
            syncProtocol.readSyncMessage(decoder, encoder, room.doc, null);

            if (encoding.length(encoder) > 1) {
              ws.send(encoding.toUint8Array(encoder));
            }

            // Broadcast sync update to other clients
            // Re-encode what we received to forward
            if (message.length > 1) {
              for (const client of room.clients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(message);
                }
              }
            }
            break;
          }
          case MSG_AWARENESS: {
            awarenessProtocol.applyAwarenessUpdate(
              room.awareness,
              decoding.readVarUint8Array(decoder),
              ws
            );
            break;
          }
        }
      } catch (err) {
        console.error(`[yjs] Error handling message for room ${docId}:`, err);
      }
    });

    ws.on("close", () => {
      room.clients.delete(ws);
      room.awareness.off("update", awarenessChangeHandler);

      // Remove awareness state for this client
      awarenessProtocol.removeAwarenessStates(
        room.awareness,
        [room.doc.clientID],
        null
      );

      if (room.clients.size === 0) {
        this.cleanupRoom(docId);
      }
    });

    ws.on("error", (err) => {
      console.error(`[yjs] WebSocket error in room ${docId}:`, err);
      ws.close();
    });
  }

  /** Flush a room's Yjs doc content to disk. */
  private flushRoom(room: Room): void {
    if (!room.dirty) return;

    const ytext = room.doc.getText("codemirror");
    const content = ytext.toString();
    const success = this.storage.update(room.docId, content);
    if (success) {
      room.dirty = false;
      console.log(`[yjs] Flushed room ${room.docId} to disk`);
    } else {
      console.warn(`[yjs] Failed to flush room ${room.docId} — doc not found on disk`);
    }
  }

  /** Clean up a room when all clients have disconnected. */
  private cleanupRoom(docId: string): void {
    const room = this.rooms.get(docId);
    if (!room) return;

    // Final flush before cleanup
    this.flushRoom(room);

    // Stop periodic flush
    if (room.flushTimer) {
      clearInterval(room.flushTimer);
    }

    // Destroy awareness and doc
    room.awareness.destroy();
    room.doc.destroy();

    this.rooms.delete(docId);
    console.log(`[yjs] Cleaned up room ${docId}`);
  }
}
