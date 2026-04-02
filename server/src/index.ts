import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { existsSync } from "node:fs";
import path from "node:path";
import { Storage } from "./storage.js";

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

// Serve built client assets in production
const clientDistPath = path.resolve(import.meta.dirname ?? ".", "../../client/dist");
if (existsSync(clientDistPath)) {
  app.use("/*", serveStatic({ root: clientDistPath }));
}

console.log(`Server starting on port ${PORT}`);
console.log(`Storage directory: ${STORAGE_DIR}`);
console.log(`Base URL: ${BASE_URL}`);

serve({
  fetch: app.fetch,
  port: PORT,
});

export { storage };
