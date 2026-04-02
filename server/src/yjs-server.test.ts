import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import WebSocket from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { Storage } from "./storage.js";
import { YjsServer } from "./yjs-server.js";

const MSG_SYNC = 0;

interface BufferedClient {
  ws: WebSocket;
  messages: Uint8Array[];
  waitForMessage: (timeoutMs?: number) => Promise<Uint8Array>;
}

function createTestSetup() {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "yjs-test-"));
  const storage = new Storage(tmpDir);
  const yjsServer = new YjsServer(storage);

  const httpServer = createServer();
  httpServer.on("upgrade", (req, socket, head) => {
    yjsServer.handleUpgrade(req, socket, head);
  });

  return { tmpDir, storage, yjsServer, httpServer };
}

function startServer(httpServer: Server): Promise<number> {
  return new Promise((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => {
      const addr = httpServer.address() as { port: number };
      resolve(addr.port);
    });
  });
}

function closeServer(httpServer: Server): Promise<void> {
  return new Promise((resolve) => {
    httpServer.close(() => resolve());
  });
}

function connectClient(port: number, docId: string): Promise<BufferedClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?doc=${docId}`);
    ws.binaryType = "arraybuffer";
    const messages: Uint8Array[] = [];
    const waiters: ((msg: Uint8Array) => void)[] = [];

    ws.on("message", (data: ArrayBuffer | Buffer) => {
      let msg: Uint8Array;
      if (data instanceof ArrayBuffer) {
        msg = new Uint8Array(data);
      } else {
        const buf = data as Buffer;
        msg = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      }
      if (waiters.length > 0) {
        waiters.shift()!(msg);
      } else {
        messages.push(msg);
      }
    });

    const waitForMessage = (timeoutMs = 3000): Promise<Uint8Array> => {
      if (messages.length > 0) {
        return Promise.resolve(messages.shift()!);
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("waitForMessage timed out")), timeoutMs);
        waiters.push((msg) => {
          clearTimeout(timer);
          resolve(msg);
        });
      });
    };

    ws.on("open", () => resolve({ ws, messages, waitForMessage }));
    ws.on("error", reject);
  });
}

function closeWs(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.on("close", () => resolve());
    ws.close();
  });
}

describe("YjsServer", () => {
  let tmpDir: string;
  let storage: Storage;
  let httpServer: Server;
  let port: number;
  let clients: BufferedClient[];

  beforeEach(async () => {
    const setup = createTestSetup();
    tmpDir = setup.tmpDir;
    storage = setup.storage;
    httpServer = setup.httpServer;
    port = await startServer(httpServer);
    clients = [];
  });

  afterEach(async () => {
    // Close all clients first
    for (const c of clients) {
      await closeWs(c.ws);
    }
    await closeServer(httpServer);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("accepts a WebSocket connection and sends sync step 1", async () => {
    const slug = storage.create("test-owner", "# Hello");
    const client = await connectClient(port, slug);
    clients.push(client);

    const msg = await client.waitForMessage();
    const decoder = decoding.createDecoder(msg);
    const msgType = decoding.readVarUint(decoder);
    expect(msgType).toBe(MSG_SYNC);
  });

  it("loads existing document content into Yjs", async () => {
    const content = "# Test Document\n\nHello world!";
    const slug = storage.create("test-owner", content);
    const client = await connectClient(port, slug);
    clients.push(client);

    // Receive sync step 1 from server
    const msg1 = await client.waitForMessage();
    const clientDoc = new Y.Doc();
    const decoder1 = decoding.createDecoder(msg1);
    decoding.readVarUint(decoder1); // skip msg type

    // Process server's sync step 1 -> generates sync step 2 response
    const responseEncoder = encoding.createEncoder();
    encoding.writeVarUint(responseEncoder, MSG_SYNC);
    syncProtocol.readSyncMessage(decoder1, responseEncoder, clientDoc, null);
    // Send our sync step 2 back to server
    if (encoding.length(responseEncoder) > 1) {
      client.ws.send(encoding.toUint8Array(responseEncoder));
    }

    // Send our sync step 1 to request server's data
    const encoder2 = encoding.createEncoder();
    encoding.writeVarUint(encoder2, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder2, clientDoc);
    client.ws.send(encoding.toUint8Array(encoder2));

    // Receive messages from server until we get the sync data
    // (may include awareness messages interspersed)
    let synced = false;
    for (let i = 0; i < 5 && !synced; i++) {
      const msg = await client.waitForMessage();
      const decoder = decoding.createDecoder(msg);
      const msgType = decoding.readVarUint(decoder);
      if (msgType === MSG_SYNC) {
        const encoder = encoding.createEncoder();
        syncProtocol.readSyncMessage(decoder, encoder, clientDoc, null);
        // Check if we got content
        const ytext = clientDoc.getText("codemirror");
        if (ytext.toString() === content) {
          synced = true;
        }
      }
      // Skip awareness messages (type 1)
    }

    const ytext = clientDoc.getText("codemirror");
    expect(ytext.toString()).toBe(content);

    clientDoc.destroy();
  });

  it("rejects connection without doc parameter", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    const closeCode = await new Promise<number>((resolve) => {
      ws.on("close", (code) => resolve(code));
    });

    expect(closeCode).toBe(4000);
  });

  it("rejects connection to non-/ws path", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/other?doc=test`);

    await new Promise<void>((resolve) => {
      ws.on("error", () => resolve());
      ws.on("close", () => resolve());
    });

    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });
});
