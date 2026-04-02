/**
 * Functional smoke tests that run against the live dev server.
 *
 * Prerequisites:
 *   - Server running at http://localhost:3000
 *   - Vite dev server at http://localhost:5175 (for browser-level tests, not covered here)
 *
 * Run with: npx vitest run src/smoke.test.ts
 */
import { beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const WS_BASE = BASE_URL.replace(/^http/, "ws");

const MSG_SYNC = 0;

// ─── Helpers ────────────────────────────────────────────────────────────────

interface BufferedClient {
  ws: WebSocket;
  messages: Uint8Array[];
  waitForMessage: (timeoutMs?: number) => Promise<Uint8Array>;
}

/** Open a WebSocket with a buffered message queue. */
function connectClient(url: string): Promise<BufferedClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    const messages: Uint8Array[] = [];
    const waiters: Array<{
      resolve: (msg: Uint8Array) => void;
      reject: (err: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }> = [];

    ws.on("message", (data: ArrayBuffer | Buffer) => {
      let msg: Uint8Array;
      if (data instanceof ArrayBuffer) {
        msg = new Uint8Array(data);
      } else {
        const buf = data as Buffer;
        msg = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      }
      if (waiters.length > 0) {
        const waiter = waiters.shift()!;
        clearTimeout(waiter.timer);
        waiter.resolve(msg);
      } else {
        messages.push(msg);
      }
    });

    const waitForMessage = (timeoutMs = 3000): Promise<Uint8Array> => {
      if (messages.length > 0) {
        return Promise.resolve(messages.shift()!);
      }
      return new Promise((res, rej) => {
        const entry: typeof waiters[0] = {
          resolve: res,
          reject: rej,
          timer: setTimeout(() => {
            // Remove this waiter from the queue so it doesn't consume future messages
            const idx = waiters.indexOf(entry);
            if (idx !== -1) waiters.splice(idx, 1);
            rej(new Error("waitForMessage timed out"));
          }, timeoutMs),
        };
        waiters.push(entry);
      });
    };

    ws.on("open", () => resolve({ ws, messages, waitForMessage }));
    ws.on("error", reject);
  });
}

/** Cleanly close a WebSocket. */
function closeWs(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) return resolve();
    ws.on("close", () => resolve());
    ws.close();
  });
}

/**
 * Perform a full Yjs sync handshake with a buffered client.
 * Returns a Y.Doc populated with the server document state.
 */
async function performSync(client: BufferedClient): Promise<Y.Doc> {
  const doc = new Y.Doc();

  // 1. Receive server's sync step 1
  const msg1 = await client.waitForMessage();
  const decoder1 = decoding.createDecoder(msg1);
  const type1 = decoding.readVarUint(decoder1);
  expect(type1).toBe(MSG_SYNC);

  // Generate and send our sync step 2 (response to server's step 1)
  const respEncoder = encoding.createEncoder();
  encoding.writeVarUint(respEncoder, MSG_SYNC);
  syncProtocol.readSyncMessage(decoder1, respEncoder, doc, null);
  if (encoding.length(respEncoder) > 1) {
    client.ws.send(encoding.toUint8Array(respEncoder));
  }

  // 2. Send our own sync step 1 to request the server's data
  const step1Encoder = encoding.createEncoder();
  encoding.writeVarUint(step1Encoder, MSG_SYNC);
  syncProtocol.writeSyncStep1(step1Encoder, doc);
  client.ws.send(encoding.toUint8Array(step1Encoder));

  // 3. Process a few response messages (sync step 2, awareness, etc.)
  //    Use a short timeout for draining — the handshake should complete quickly.
  for (let i = 0; i < 5; i++) {
    try {
      const msg = await client.waitForMessage(500);
      const decoder = decoding.createDecoder(msg);
      const msgType = decoding.readVarUint(decoder);
      if (msgType === MSG_SYNC) {
        const encoder = encoding.createEncoder();
        syncProtocol.readSyncMessage(decoder, encoder, doc, null);
      }
    } catch {
      // Timeout is fine — just means no more handshake messages
      break;
    }
  }

  return doc;
}

// ─── Test suites ────────────────────────────────────────────────────────────

describe("Smoke tests — API", () => {
  it("health endpoint returns ok", async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  describe("document CRUD via API", () => {
    let createdSlug: string;

    it("POST /new creates a document and redirects", async () => {
      const res = await fetch(`${BASE_URL}/new`, {
        method: "POST",
        redirect: "manual",
      });
      // Server responds with 303 redirect
      expect(res.status).toBe(303);
      const location = res.headers.get("location");
      expect(location).toBeTruthy();
      // Location is like "/{slug}"
      createdSlug = location!.replace(/^\//, "");
      expect(createdSlug).toMatch(/^[0-9a-f]{8}$/);
    });

    it("GET /api/docs/:docId returns the created document", async () => {
      expect(createdSlug).toBeTruthy();
      const res = await fetch(`${BASE_URL}/api/docs/${createdSlug}`);
      expect(res.status).toBe(200);
      const doc = (await res.json()) as {
        slug: string;
        content: string;
        meta: { owner: string; created: string };
      };
      expect(doc.slug).toBe(createdSlug);
      expect(doc.content).toBeDefined();
      expect(doc.meta).toBeDefined();
      expect(doc.meta.owner).toBe("anonymous");
      expect(doc.meta.created).toBeTruthy();
    });

    it("GET /api/docs lists documents including the new one", async () => {
      expect(createdSlug).toBeTruthy();
      const res = await fetch(`${BASE_URL}/api/docs`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { docs: Array<{ slug: string; owner: string }> };
      expect(Array.isArray(body.docs)).toBe(true);
      const found = body.docs.find((d) => d.slug === createdSlug);
      expect(found).toBeTruthy();
      expect(found!.owner).toBe("anonymous");
    });

    it("GET /api/docs/:docId returns 404 for non-existent doc", async () => {
      const res = await fetch(`${BASE_URL}/api/docs/doesnotexist`);
      expect(res.status).toBe(404);
    });
  });
});

describe("Smoke tests — WebSocket / Yjs sync", () => {
  let slug: string;

  beforeAll(async () => {
    // Create a fresh doc for WebSocket tests
    const res = await fetch(`${BASE_URL}/new`, { method: "POST", redirect: "manual" });
    slug = res.headers.get("location")!.replace(/^\//, "");
  });

  it("connects to a WebSocket room and receives sync step 1", async () => {
    const client = await connectClient(`${WS_BASE}/ws?doc=${slug}`);
    try {
      const msg = await client.waitForMessage();
      const decoder = decoding.createDecoder(msg);
      const msgType = decoding.readVarUint(decoder);
      expect(msgType).toBe(MSG_SYNC);
    } finally {
      await closeWs(client.ws);
    }
  });

  it("rejects WebSocket without doc param", async () => {
    const ws = new WebSocket(`${WS_BASE}/ws`);
    const code = await new Promise<number>((resolve) => {
      ws.on("close", (code) => resolve(code));
      ws.on("error", () => {}); // suppress unhandled error
    });
    expect(code).toBe(4000);
  });

  it("two clients sync edits through the Yjs server", async () => {
    // Create a dedicated doc for this test
    const res = await fetch(`${BASE_URL}/new`, { method: "POST", redirect: "manual" });
    const syncSlug = res.headers.get("location")!.replace(/^\//, "");

    // Connect and sync both clients
    const clientA = await connectClient(`${WS_BASE}/ws?doc=${syncSlug}`);
    const docA = await performSync(clientA);

    const clientB = await connectClient(`${WS_BASE}/ws?doc=${syncSlug}`);
    const docB = await performSync(clientB);

    // Drain any straggling messages on B (awareness updates from A joining, etc.)
    // so the queue is clean before we send the edit.
    await new Promise((r) => setTimeout(r, 200));
    clientB.messages.length = 0;

    // Set up A to forward local updates to the server
    const testText = `smoke-test-${Date.now()}`;
    docA.on("update", (update: Uint8Array, origin: any) => {
      if (origin === "local") return; // don't re-send remote updates
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      if (clientA.ws.readyState === WebSocket.OPEN) {
        clientA.ws.send(encoding.toUint8Array(encoder));
      }
    });

    // Client A inserts text (this triggers the update handler above)
    docA.getText("codemirror").insert(0, testText);

    // Client B receives the update from server
    let synced = false;
    for (let i = 0; i < 10 && !synced; i++) {
      const msg = await clientB.waitForMessage(3000);
      const decoder = decoding.createDecoder(msg);
      const msgType = decoding.readVarUint(decoder);
      if (msgType === MSG_SYNC) {
        const respEncoder = encoding.createEncoder();
        syncProtocol.readSyncMessage(decoder, respEncoder, docB, null);
      }
      const ytextB = docB.getText("codemirror");
      if (ytextB.toString().includes(testText)) {
        synced = true;
      }
    }

    expect(docB.getText("codemirror").toString()).toContain(testText);

    // Cleanup
    docA.destroy();
    docB.destroy();
    await closeWs(clientA.ws);
    await closeWs(clientB.ws);
  });
});
