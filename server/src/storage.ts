import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Document, DocumentMeta, DocumentSummary } from "@multiplayer-markdown/shared";

/**
 * File-system storage layer for markdown documents.
 *
 * Each document is stored as two files:
 *   - `{slug}.md`          — the markdown content
 *   - `{slug}.meta.json`   — sidecar with owner + created timestamp
 */
export class Storage {
  private readonly dir: string;

  constructor(storageDir: string) {
    this.dir = path.resolve(storageDir);
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  /** Generate a short URL-safe slug (8 hex chars). */
  private generateSlug(): string {
    return randomBytes(4).toString("hex");
  }

  private mdPath(slug: string): string {
    return path.join(this.dir, `${slug}.md`);
  }

  private metaPath(slug: string): string {
    return path.join(this.dir, `${slug}.meta.json`);
  }

  /** Create a new document. Returns the generated slug. */
  create(owner: string, content = ""): string {
    let slug = this.generateSlug();
    // Avoid (extremely unlikely) collisions
    while (existsSync(this.mdPath(slug))) {
      slug = this.generateSlug();
    }

    const meta: DocumentMeta = {
      owner,
      created: new Date().toISOString(),
    };

    writeFileSync(this.mdPath(slug), content, "utf-8");
    writeFileSync(this.metaPath(slug), JSON.stringify(meta, null, 2), "utf-8");

    return slug;
  }

  /** Read a document by slug. Returns null if not found. */
  read(slug: string): Document | null {
    const md = this.mdPath(slug);
    const metaFile = this.metaPath(slug);

    if (!existsSync(md)) return null;

    const content = readFileSync(md, "utf-8");
    const meta: DocumentMeta = existsSync(metaFile)
      ? JSON.parse(readFileSync(metaFile, "utf-8"))
      : { owner: "unknown", created: new Date(0).toISOString() };

    return { slug, content, meta };
  }

  /** Update a document's markdown content. Returns false if not found. */
  update(slug: string, content: string): boolean {
    const md = this.mdPath(slug);
    if (!existsSync(md)) return false;
    writeFileSync(md, content, "utf-8");
    return true;
  }

  /** Extract the title from markdown content (first # heading, or "Untitled"). */
  private extractTitle(content: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : "Untitled";
  }

  /** List all documents as summaries. */
  list(): DocumentSummary[] {
    if (!existsSync(this.dir)) return [];

    const entries = readdirSync(this.dir);
    const summaries: DocumentSummary[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;

      const slug = entry.replace(/\.md$/, "");
      const mdFile = this.mdPath(slug);
      const metaFile = this.metaPath(slug);

      const content = readFileSync(mdFile, "utf-8");
      const stat = statSync(mdFile);

      const meta: DocumentMeta = existsSync(metaFile)
        ? JSON.parse(readFileSync(metaFile, "utf-8"))
        : { owner: "unknown", created: stat.birthtime.toISOString() };

      summaries.push({
        slug,
        title: this.extractTitle(content),
        owner: meta.owner,
        created: meta.created,
        lastModified: stat.mtime.toISOString(),
      });
    }

    // Sort by last modified, newest first
    summaries.sort(
      (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
    );

    return summaries;
  }
}
