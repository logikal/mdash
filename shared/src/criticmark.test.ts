import { describe, it, expect } from "vitest";
import {
  parse,
  serialize,
  serializeAnnotation,
  type AdditionAnnotation,
  type DeletionAnnotation,
  type SubstitutionAnnotation,
  type CommentAnnotation,
  type HighlightAnnotation,
} from "./criticmark.js";

// ---------------------------------------------------------------------------
// Parser tests
// ---------------------------------------------------------------------------

describe("parse", () => {
  it("parses a simple addition", () => {
    const md = "Hello {++world++}!";
    const annotations = parse(md);
    expect(annotations).toHaveLength(1);
    const a = annotations[0] as AdditionAnnotation;
    expect(a.type).toBe("addition");
    expect(a.content).toBe("world");
    expect(a.author).toBeUndefined();
    expect(a.start).toBe(6);
    expect(a.end).toBe(17);
  });

  it("parses an addition with author", () => {
    const md = "{++@alice: new text++}";
    const annotations = parse(md);
    expect(annotations).toHaveLength(1);
    const a = annotations[0] as AdditionAnnotation;
    expect(a.type).toBe("addition");
    expect(a.author).toBe("alice");
    expect(a.content).toBe("new text");
  });

  it("parses a simple deletion", () => {
    const md = "Remove {--this--} word";
    const annotations = parse(md);
    expect(annotations).toHaveLength(1);
    const a = annotations[0] as DeletionAnnotation;
    expect(a.type).toBe("deletion");
    expect(a.content).toBe("this");
    expect(a.author).toBeUndefined();
  });

  it("parses a deletion with author", () => {
    const md = "{--@bob: old text--}";
    const annotations = parse(md);
    expect(annotations).toHaveLength(1);
    const a = annotations[0] as DeletionAnnotation;
    expect(a.author).toBe("bob");
    expect(a.content).toBe("old text");
  });

  it("parses a substitution", () => {
    const md = "Use {~~color~>colour~~} spelling";
    const annotations = parse(md);
    expect(annotations).toHaveLength(1);
    const a = annotations[0] as SubstitutionAnnotation;
    expect(a.type).toBe("substitution");
    expect(a.oldContent).toBe("color");
    expect(a.newContent).toBe("colour");
  });

  it("parses a simple comment", () => {
    const md = "Check this{>>needs citation<<}";
    const annotations = parse(md);
    expect(annotations).toHaveLength(1);
    const a = annotations[0] as CommentAnnotation;
    expect(a.type).toBe("comment");
    expect(a.body).toBe("needs citation");
    expect(a.threads).toHaveLength(0);
  });

  it("parses a comment with threaded messages", () => {
    const md = `{>>@alice 2026-04-01T10:00:00Z: First comment
@bob 2026-04-01T10:05:00Z: Reply<<}`;
    const annotations = parse(md);
    expect(annotations).toHaveLength(1);
    const a = annotations[0] as CommentAnnotation;
    expect(a.type).toBe("comment");
    expect(a.threads).toHaveLength(2);
    expect(a.threads[0].user).toBe("alice");
    expect(a.threads[0].timestamp).toBe("2026-04-01T10:00:00Z");
    expect(a.threads[0].message).toBe("First comment");
    expect(a.threads[1].user).toBe("bob");
    expect(a.threads[1].message).toBe("Reply");
  });

  it("parses comment thread with continuation lines", () => {
    const md = `{>>@alice 2026-04-01T10:00:00Z: Line one
continued here<<}`;
    const annotations = parse(md);
    const a = annotations[0] as CommentAnnotation;
    expect(a.threads).toHaveLength(1);
    expect(a.threads[0].message).toBe("Line one\ncontinued here");
  });

  it("parses a highlight", () => {
    const md = "This is {==important==} text";
    const annotations = parse(md);
    expect(annotations).toHaveLength(1);
    const a = annotations[0] as HighlightAnnotation;
    expect(a.type).toBe("highlight");
    expect(a.content).toBe("important");
  });

  it("parses multiple annotations in one string", () => {
    const md = "{++added++} and {--removed--} and {==highlighted==}";
    const annotations = parse(md);
    expect(annotations).toHaveLength(3);
    expect(annotations[0].type).toBe("addition");
    expect(annotations[1].type).toBe("deletion");
    expect(annotations[2].type).toBe("highlight");
  });

  it("returns empty array for no annotations", () => {
    expect(parse("plain markdown")).toEqual([]);
  });

  it("handles multiline addition content", () => {
    const md = "{++line one\nline two++}";
    const annotations = parse(md);
    expect(annotations).toHaveLength(1);
    expect((annotations[0] as AdditionAnnotation).content).toBe("line one\nline two");
  });

  it("handles multiline substitution", () => {
    const md = "{~~old\ntext~>new\ntext~~}";
    const annotations = parse(md);
    expect(annotations).toHaveLength(1);
    const a = annotations[0] as SubstitutionAnnotation;
    expect(a.oldContent).toBe("old\ntext");
    expect(a.newContent).toBe("new\ntext");
  });
});

// ---------------------------------------------------------------------------
// Serializer tests
// ---------------------------------------------------------------------------

describe("serializeAnnotation", () => {
  it("serializes addition", () => {
    const ann: AdditionAnnotation = {
      type: "addition",
      start: 0,
      end: 0,
      content: "hello",
    };
    expect(serializeAnnotation(ann)).toBe("{++hello++}");
  });

  it("serializes addition with author", () => {
    const ann: AdditionAnnotation = {
      type: "addition",
      start: 0,
      end: 0,
      content: "hello",
      author: "alice",
    };
    expect(serializeAnnotation(ann)).toBe("{++@alice: hello++}");
  });

  it("serializes deletion", () => {
    const ann: DeletionAnnotation = {
      type: "deletion",
      start: 0,
      end: 0,
      content: "gone",
    };
    expect(serializeAnnotation(ann)).toBe("{--gone--}");
  });

  it("serializes deletion with author", () => {
    const ann: DeletionAnnotation = {
      type: "deletion",
      start: 0,
      end: 0,
      content: "gone",
      author: "bob",
    };
    expect(serializeAnnotation(ann)).toBe("{--@bob: gone--}");
  });

  it("serializes substitution", () => {
    const ann: SubstitutionAnnotation = {
      type: "substitution",
      start: 0,
      end: 0,
      oldContent: "old",
      newContent: "new",
    };
    expect(serializeAnnotation(ann)).toBe("{~~old~>new~~}");
  });

  it("serializes comment", () => {
    const ann: CommentAnnotation = {
      type: "comment",
      start: 0,
      end: 0,
      body: "a note",
      threads: [],
    };
    expect(serializeAnnotation(ann)).toBe("{>>a note<<}");
  });

  it("serializes highlight", () => {
    const ann: HighlightAnnotation = {
      type: "highlight",
      start: 0,
      end: 0,
      content: "key point",
    };
    expect(serializeAnnotation(ann)).toBe("{==key point==}");
  });
});

describe("serialize (full document rebuild)", () => {
  it("rebuilds document with modified annotation", () => {
    const original = "Hello {++world++}!";
    const annotations = parse(original);
    // Modify the content
    (annotations[0] as AdditionAnnotation).content = "earth";
    const result = serialize(original, annotations);
    expect(result).toBe("Hello {++earth++}!");
  });

  it("handles multiple annotations without offset corruption", () => {
    const original = "{++a++} and {--b--}";
    const annotations = parse(original);
    const result = serialize(original, annotations);
    expect(result).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests
// ---------------------------------------------------------------------------

describe("round-trip (parse then serialize)", () => {
  const cases = [
    "Hello {++world++}!",
    "{++@alice: new text++}",
    "Remove {--this--} word",
    "{--@bob: old text--}",
    "Use {~~color~>colour~~} spelling",
    "Check this{>>needs citation<<}",
    "This is {==important==} text",
    "{++added++} and {--removed--} and {==highlighted==}",
    "{++line one\nline two++}",
    "{~~old\ntext~>new\ntext~~}",
    `{>>@alice 2026-04-01T10:00:00Z: First comment
@bob 2026-04-01T10:05:00Z: Reply<<}`,
    "No annotations at all",
    "",
  ];

  for (const input of cases) {
    it(`round-trips: ${JSON.stringify(input).slice(0, 60)}`, () => {
      const annotations = parse(input);
      const output = serialize(input, annotations);
      expect(output).toBe(input);
    });
  }
});
