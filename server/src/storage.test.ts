import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Storage } from "./storage.js";

describe("Storage", () => {
  let dir: string;
  let storage: Storage;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "storage-test-"));
    storage = new Storage(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates storage directory if it does not exist", () => {
    const newDir = path.join(dir, "nested", "dir");
    new Storage(newDir);
    expect(existsSync(newDir)).toBe(true);
  });

  describe("create", () => {
    it("creates .md and .meta.json files", () => {
      const slug = storage.create("alice", "# Hello\n\nWorld");

      expect(existsSync(path.join(dir, `${slug}.md`))).toBe(true);
      expect(existsSync(path.join(dir, `${slug}.meta.json`))).toBe(true);

      const content = readFileSync(path.join(dir, `${slug}.md`), "utf-8");
      expect(content).toBe("# Hello\n\nWorld");

      const meta = JSON.parse(readFileSync(path.join(dir, `${slug}.meta.json`), "utf-8"));
      expect(meta.owner).toBe("alice");
      expect(meta.created).toBeTruthy();
      // Verify ISO-8601 format
      expect(new Date(meta.created).toISOString()).toBe(meta.created);
    });

    it("creates with empty content by default", () => {
      const slug = storage.create("bob");
      const content = readFileSync(path.join(dir, `${slug}.md`), "utf-8");
      expect(content).toBe("");
    });

    it("generates unique slugs", () => {
      const slugs = new Set<string>();
      for (let i = 0; i < 50; i++) {
        slugs.add(storage.create("user"));
      }
      expect(slugs.size).toBe(50);
    });
  });

  describe("read", () => {
    it("reads a created document", () => {
      const slug = storage.create("alice", "# Test Doc\n\nContent here.");
      const doc = storage.read(slug);

      expect(doc).not.toBeNull();
      expect(doc!.slug).toBe(slug);
      expect(doc!.content).toBe("# Test Doc\n\nContent here.");
      expect(doc!.meta.owner).toBe("alice");
    });

    it("returns null for non-existent document", () => {
      expect(storage.read("nonexistent")).toBeNull();
    });
  });

  describe("update", () => {
    it("updates document content", () => {
      const slug = storage.create("alice", "original");
      const updated = storage.update(slug, "updated content");

      expect(updated).toBe(true);
      const doc = storage.read(slug);
      expect(doc!.content).toBe("updated content");
    });

    it("returns false for non-existent document", () => {
      expect(storage.update("nonexistent", "content")).toBe(false);
    });

    it("preserves metadata after update", () => {
      const slug = storage.create("alice", "original");
      const before = storage.read(slug)!;
      storage.update(slug, "updated");
      const after = storage.read(slug)!;

      expect(after.meta.owner).toBe(before.meta.owner);
      expect(after.meta.created).toBe(before.meta.created);
    });
  });

  describe("list", () => {
    it("returns empty array when no documents exist", () => {
      expect(storage.list()).toEqual([]);
    });

    it("lists all documents with summaries", () => {
      storage.create("alice", "# First Doc\n\nHello");
      storage.create("bob", "# Second Doc\n\nWorld");

      const docs = storage.list();
      expect(docs).toHaveLength(2);

      const titles = docs.map((d) => d.title);
      expect(titles).toContain("First Doc");
      expect(titles).toContain("Second Doc");
    });

    it("extracts title from first heading", () => {
      const slug = storage.create("alice", "# My Title\n\nSome content\n\n## Subheading");
      const docs = storage.list();
      const doc = docs.find((d) => d.slug === slug)!;
      expect(doc.title).toBe("My Title");
    });

    it("uses 'Untitled' when no heading exists", () => {
      const slug = storage.create("alice", "No heading here");
      const docs = storage.list();
      const doc = docs.find((d) => d.slug === slug)!;
      expect(doc.title).toBe("Untitled");
    });

    it("includes owner and dates in summaries", () => {
      const slug = storage.create("alice", "# Test");
      const docs = storage.list();
      const doc = docs.find((d) => d.slug === slug)!;

      expect(doc.owner).toBe("alice");
      expect(doc.created).toBeTruthy();
      expect(doc.lastModified).toBeTruthy();
    });
  });
});
