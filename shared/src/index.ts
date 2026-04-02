// Shared types and utilities between client and server
export const APP_NAME = "Multiplayer Markdown";

export * from "./criticmark.js";

/** Sidecar metadata stored alongside each .md file */
export interface DocumentMeta {
  owner: string;
  created: string; // ISO-8601
}

/** Summary returned when listing documents */
export interface DocumentSummary {
  slug: string;
  title: string;
  owner: string;
  created: string;
  lastModified: string;
}

/** Full document with content and metadata */
export interface Document {
  slug: string;
  content: string;
  meta: DocumentMeta;
}
