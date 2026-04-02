import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const app = new Hono();

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const STORAGE_DIR = process.env.STORAGE_DIR ?? "./storage";
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

// Ensure storage directory exists
if (!existsSync(STORAGE_DIR)) {
  mkdirSync(STORAGE_DIR, { recursive: true });
}

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// API routes (placeholder)
app.get("/api/docs", (c) => c.json({ docs: [] }));

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
