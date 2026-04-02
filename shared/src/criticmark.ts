/**
 * CriticMark parser and serializer.
 *
 * Supports the five CriticMark annotation types:
 *   Addition:     {++text++}        or  {++@author: text++}
 *   Deletion:     {--text--}        or  {--@author: text--}
 *   Substitution: {~~old~>new~~}
 *   Comment:      {>>body<<}
 *   Highlight:    {==text==}
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnnotationType = "addition" | "deletion" | "substitution" | "comment" | "highlight";

export interface BaseAnnotation {
  /** Character offset of the opening delimiter (e.g. `{++`) in the source */
  start: number;
  /** Character offset one past the closing delimiter (e.g. `++}`) */
  end: number;
  type: AnnotationType;
}

export interface AdditionAnnotation extends BaseAnnotation {
  type: "addition";
  content: string;
  author?: string;
}

export interface DeletionAnnotation extends BaseAnnotation {
  type: "deletion";
  content: string;
  author?: string;
}

export interface SubstitutionAnnotation extends BaseAnnotation {
  type: "substitution";
  oldContent: string;
  newContent: string;
}

export interface CommentThread {
  user: string;
  timestamp: string;
  message: string;
}

export interface CommentAnnotation extends BaseAnnotation {
  type: "comment";
  body: string;
  /** Parsed thread entries when the body follows `@user timestamp: message` format */
  threads: CommentThread[];
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: "highlight";
  content: string;
}

export type Annotation =
  | AdditionAnnotation
  | DeletionAnnotation
  | SubstitutionAnnotation
  | CommentAnnotation
  | HighlightAnnotation;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Regex that matches any CriticMark annotation.
 *
 * Groups:
 *   1 - addition  body
 *   2 - deletion  body
 *   3 - substitution old
 *   4 - substitution new
 *   5 - comment   body
 *   6 - highlight body
 */
const CRITIC_RE =
  /\{\+\+([\s\S]*?)\+\+\}|\{--([\s\S]*?)--\}|\{~~([\s\S]*?)~>([\s\S]*?)~~\}|\{>>([\s\S]*?)<<\}|\{==([\s\S]*?)==\}/g;

/** Parse `@author: content` prefix used in additions / deletions. */
function parseAuthorPrefix(raw: string): { author?: string; content: string } {
  const m = raw.match(/^@([^:]+):\s*([\s\S]*)$/);
  if (m) {
    return { author: m[1].trim(), content: m[2] };
  }
  return { content: raw };
}

/**
 * Parse multi-line comment threads.
 * Each line that starts with `@user timestamp: message` is a thread entry.
 * Lines that don't match are part of the preceding entry or the raw body.
 */
function parseCommentThreads(body: string): CommentThread[] {
  const threads: CommentThread[] = [];
  // Pattern: @user ISO-timestamp: message
  const lineRe =
    /^@(\S+)\s+(\d{4}-\d{2}-\d{2}T[^\s:]+(?::\d{2}[^\s:]*)*(?::\d{2}[^\s]*)?)\s*:\s*([\s\S]*?)$/;

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(lineRe);
    if (m) {
      threads.push({
        user: m[1],
        timestamp: m[2],
        message: m[3].trim(),
      });
    } else if (threads.length > 0) {
      // continuation of previous message
      threads[threads.length - 1].message += "\n" + trimmed;
    }
    // else: non-thread body line (ignored for threads array)
  }
  return threads;
}

/**
 * Parse all CriticMark annotations from a markdown string.
 * Returns annotations sorted by their `start` offset.
 */
export function parse(markdown: string): Annotation[] {
  const annotations: Annotation[] = [];
  let match: RegExpExecArray | null;

  // Reset the regex
  CRITIC_RE.lastIndex = 0;

  while ((match = CRITIC_RE.exec(markdown)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (match[1] !== undefined) {
      // Addition
      const { author, content } = parseAuthorPrefix(match[1]);
      const ann: AdditionAnnotation = { type: "addition", start, end, content };
      if (author) ann.author = author;
      annotations.push(ann);
    } else if (match[2] !== undefined) {
      // Deletion
      const { author, content } = parseAuthorPrefix(match[2]);
      const ann: DeletionAnnotation = { type: "deletion", start, end, content };
      if (author) ann.author = author;
      annotations.push(ann);
    } else if (match[3] !== undefined && match[4] !== undefined) {
      // Substitution
      annotations.push({
        type: "substitution",
        start,
        end,
        oldContent: match[3],
        newContent: match[4],
      });
    } else if (match[5] !== undefined) {
      // Comment
      const body = match[5];
      annotations.push({
        type: "comment",
        start,
        end,
        body,
        threads: parseCommentThreads(body),
      });
    } else if (match[6] !== undefined) {
      // Highlight
      annotations.push({
        type: "highlight",
        start,
        end,
        content: match[6],
      });
    }
  }

  return annotations;
}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

/** Serialize a single annotation back to CriticMark syntax. */
export function serializeAnnotation(annotation: Annotation): string {
  switch (annotation.type) {
    case "addition": {
      const prefix = annotation.author ? `@${annotation.author}: ` : "";
      return `{++${prefix}${annotation.content}++}`;
    }
    case "deletion": {
      const prefix = annotation.author ? `@${annotation.author}: ` : "";
      return `{--${prefix}${annotation.content}--}`;
    }
    case "substitution":
      return `{~~${annotation.oldContent}~>${annotation.newContent}~~}`;
    case "comment":
      return `{>>${annotation.body}<<}`;
    case "highlight":
      return `{==${annotation.content}==}`;
  }
}

/**
 * Rebuild a markdown string by replacing annotation ranges with serialized forms.
 *
 * This is useful when annotations have been modified (e.g. content changed)
 * and you want to produce the updated markdown.
 *
 * **Important**: annotations must not overlap and should be sorted by `start`.
 * The function sorts them internally for safety.
 */
export function serialize(original: string, annotations: Annotation[]): string {
  // Sort descending by start so replacements don't shift offsets
  const sorted = [...annotations].sort((a, b) => b.start - a.start);
  let result = original;
  for (const ann of sorted) {
    result = result.slice(0, ann.start) + serializeAnnotation(ann) + result.slice(ann.end);
  }
  return result;
}
