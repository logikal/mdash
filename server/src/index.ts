import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Storage } from "./storage.js";
import { YjsServer } from "./yjs-server.js";

const app = new Hono();

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const STORAGE_DIR = process.env.STORAGE_DIR ?? "./storage";
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

// Initialize storage (ensures directory exists)
const storage = new Storage(STORAGE_DIR);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// API routes
app.get("/api/docs", (c) => {
  const docs = storage.list();
  return c.json({ docs });
});

app.get("/api/docs/:docId", (c) => {
  const doc = storage.read(c.req.param("docId"));
  if (!doc) return c.json({ error: "Document not found" }, 404);
  return c.json(doc);
});

// Create new document, redirect to editor
app.post("/new", async (c) => {
  const owner = "anonymous"; // Will be set from client later
  let content = "";

  // Support uploading markdown content in the request body
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = await c.req.json();
      content = body.content ?? "";
    } catch {
      // Ignore parse errors, create empty doc
    }
  } else {
    // Raw text body (for curl -T uploads and plain POST)
    const text = await c.req.text();
    if (text) content = text;
  }

  const slug = storage.create(owner, content);
  return c.redirect(`/${slug}`, 303);
});

// CLI upload via curl -T file.md (PUT /new)
app.put("/new", async (c) => {
  const owner = "anonymous";
  const content = await c.req.text();
  const slug = storage.create(owner, content);
  const docUrl = `${BASE_URL}/${slug}`;

  return c.text(docUrl + "\n", 201, {
    Location: docUrl,
  });
});

// Serve built client assets in production
const clientDistPath = path.resolve(import.meta.dirname ?? ".", "../../client/dist");
const indexHtmlPath = path.join(clientDistPath, "index.html");

if (existsSync(clientDistPath)) {
  // Serve static assets (JS, CSS, etc.)
  app.use("/assets/*", serveStatic({ root: clientDistPath }));

  // SPA fallback: serve index.html for all non-API, non-asset routes
  app.get("*", (c) => {
    // Skip if this looks like an API call or asset request
    const pathname = new URL(c.req.url).pathname;
    if (pathname.startsWith("/api/") || pathname.startsWith("/health")) {
      return c.notFound();
    }
    if (existsSync(indexHtmlPath)) {
      const html = readFileSync(indexHtmlPath, "utf-8");
      return c.html(html);
    }
    return c.notFound();
  });
}

// Yjs WebSocket server for real-time collaboration
const yjsServer = new YjsServer(storage);

console.log(`Server starting on port ${PORT}`);
console.log(`Storage directory: ${STORAGE_DIR}`);
console.log(`Base URL: ${BASE_URL}`);

const server = serve({
  fetch: app.fetch,
  hostname: "0.0.0.0",
  port: PORT,
});

// Handle WebSocket upgrade requests for Yjs collaboration
server.on("upgrade", (req, socket, head) => {
  yjsServer.handleUpgrade(req, socket, head);
});

export { storage, yjsServer };
