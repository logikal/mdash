/**
 * CodeMirror 6 extension for comment interactions.
 *
 * - Detects clicks on CriticMark comment ranges ({>>...<<})
 * - Manages popover state (which comment is open, its screen position)
 * - Provides keyboard shortcut (Ctrl+Shift+M) to add a new comment on selection
 * - Exposes a StateField so React can read popover state and render the UI
 */

import {
  StateField,
  StateEffect,
  type EditorState,
} from "@codemirror/state";
import {
  EditorView,
  keymap,
  type ViewUpdate,
  ViewPlugin,
} from "@codemirror/view";
import { suggestModeField } from "./suggest-mode";

// ---------------------------------------------------------------------------
// Inline types matching shared/criticmark (avoid cross-workspace import)
// ---------------------------------------------------------------------------

export interface CommentThread {
  user: string;
  timestamp: string;
  message: string;
}

export interface CommentAnnotation {
  type: "comment";
  start: number;
  end: number;
  body: string;
  threads: CommentThread[];
}

// ---------------------------------------------------------------------------
// Comment popover state
// ---------------------------------------------------------------------------

export interface CommentPopoverState {
  /** Whether the popover is currently shown */
  open: boolean;
  /** The parsed comment annotation */
  comment: CommentAnnotation | null;
  /** Screen coordinates for positioning the popover */
  coords: { x: number; y: number } | null;
}

const defaultPopoverState: CommentPopoverState = {
  open: false,
  comment: null,
  coords: null,
};

/** Effect to open/close the comment popover */
export const commentPopoverEffect = StateEffect.define<CommentPopoverState>();

/** StateField tracking the comment popover state */
export const commentPopoverField = StateField.define<CommentPopoverState>({
  create() {
    return defaultPopoverState;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(commentPopoverEffect)) {
        return effect.value;
      }
    }
    // Close popover if the document changed (comment may have moved/changed)
    if (tr.docChanged && value.open) {
      return defaultPopoverState;
    }
    return value;
  },
});

// ---------------------------------------------------------------------------
// Inline comment parser (matches {>>body<<})
// ---------------------------------------------------------------------------

const COMMENT_RE = /\{>>([\s\S]*?)<<\}/g;

/** Parse `@user timestamp: message` thread lines from a comment body. */
function parseCommentThreads(body: string): CommentThread[] {
  const threads: CommentThread[] = [];
  const lineRe =
    /^@(\S+)\s+(\d{4}-\d{2}-\d{2}T[^\s:]+(?::\d{2}[^\s:]*)*(?::\d{2}[^\s]*)?)\s*:\s*([\s\S]*?)$/;

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(lineRe);
    if (m) {
      threads.push({ user: m[1], timestamp: m[2], message: m[3].trim() });
    } else if (threads.length > 0) {
      threads[threads.length - 1].message += "\n" + trimmed;
    }
  }
  return threads;
}

// ---------------------------------------------------------------------------
// Find comment at a document position
// ---------------------------------------------------------------------------

function findCommentAt(
  state: EditorState,
  pos: number,
): CommentAnnotation | null {
  const text = state.doc.toString();
  COMMENT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = COMMENT_RE.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (pos >= start && pos <= end) {
      const body = match[1];
      return {
        type: "comment",
        start,
        end,
        body,
        threads: parseCommentThreads(body),
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Click handler: detect click on comment ranges
// ---------------------------------------------------------------------------

const commentClickPlugin = ViewPlugin.fromClass(
  class {
    constructor(_view: EditorView) {}
    update(_update: ViewUpdate) {}
  },
  {
    eventHandlers: {
      mousedown(event: MouseEvent, view: EditorView) {
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null) return;

        const comment = findCommentAt(view.state, pos);
        if (!comment) return;

        // Get coordinates for positioning the popover below the comment
        const coords = view.coordsAtPos(comment.start);
        if (!coords) return;

        // Delay dispatch to avoid interfering with other click handlers
        setTimeout(() => {
          view.dispatch({
            effects: commentPopoverEffect.of({
              open: true,
              comment,
              coords: { x: coords.left, y: coords.bottom + 4 },
            }),
          });
        }, 0);
      },
    },
  },
);

// ---------------------------------------------------------------------------
// Dismiss popover on click outside or Escape
// ---------------------------------------------------------------------------

const commentDismissPlugin = ViewPlugin.fromClass(
  class {
    constructor(_view: EditorView) {}
    update(_update: ViewUpdate) {}
  },
  {
    eventHandlers: {
      keydown(event: KeyboardEvent, view: EditorView) {
        if (event.key === "Escape") {
          const state = view.state.field(commentPopoverField, false);
          if (state?.open) {
            view.dispatch({
              effects: commentPopoverEffect.of(defaultPopoverState),
            });
          }
        }
      },
    },
  },
);

// ---------------------------------------------------------------------------
// Add comment command (Ctrl+Shift+M)
// ---------------------------------------------------------------------------

function addCommentCommand(view: EditorView): boolean {
  const { from, to } = view.state.selection.main;
  if (from === to) {
    // No selection - insert empty comment at cursor
    const smState = view.state.field(suggestModeField, false);
    const username = smState?.username || "anonymous";
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const commentText = `{>>@${username} ${timestamp}: <<}`;
    // Place cursor before the closing <<}
    const cursorPos = from + commentText.length - 3;
    view.dispatch({
      changes: { from, to, insert: commentText },
      selection: { anchor: cursorPos },
    });
    return true;
  }

  // Has selection - wrap it in a comment, with the selected text as context
  const smState = view.state.field(suggestModeField, false);
  const username = smState?.username || "anonymous";
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const selectedText = view.state.sliceDoc(from, to);
  // Insert comment right after the selection
  const commentText = `{>>@${username} ${timestamp}: <<}`;
  const insertPos = to;
  const cursorPos = insertPos + commentText.length - 3;
  view.dispatch({
    changes: { from: insertPos, to: insertPos, insert: commentText },
    selection: { anchor: cursorPos },
  });
  return true;
}

const commentKeymap = keymap.of([
  {
    key: "Mod-Shift-m",
    run: addCommentCommand,
  },
]);

// ---------------------------------------------------------------------------
// Exported: add new comment entry to an existing comment annotation
// ---------------------------------------------------------------------------

/**
 * Append a new thread entry to an existing comment annotation in the doc.
 * The new entry is inserted before the closing `<<}`.
 */
export function appendCommentEntry(
  view: EditorView,
  comment: CommentAnnotation,
  username: string,
  message: string,
): void {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const newEntry = `\n@${username} ${timestamp}: ${message}`;
  // Insert before the closing <<} (which is at comment.end - 3)
  const insertPos = comment.end - 3;
  view.dispatch({
    changes: { from: insertPos, to: insertPos, insert: newEntry },
    effects: commentPopoverEffect.of(defaultPopoverState),
  });
}

// ---------------------------------------------------------------------------
// Resolve (remove) a comment annotation from the document
// ---------------------------------------------------------------------------

/**
 * Resolve a comment by removing its `{>>...<<}` annotation from the document.
 * The CriticMark is stripped entirely, leaving clean markdown.
 */
export function resolveComment(
  view: EditorView,
  comment: CommentAnnotation,
): void {
  view.dispatch({
    changes: { from: comment.start, to: comment.end, insert: "" },
    effects: commentPopoverEffect.of(defaultPopoverState),
  });
}

// ---------------------------------------------------------------------------
// Close the popover programmatically
// ---------------------------------------------------------------------------

export function closeCommentPopover(view: EditorView): void {
  view.dispatch({
    effects: commentPopoverEffect.of(defaultPopoverState),
  });
}

// ---------------------------------------------------------------------------
// Exported combined extension
// ---------------------------------------------------------------------------

export function commentExtension() {
  return [
    commentPopoverField,
    commentClickPlugin,
    commentDismissPlugin,
    commentKeymap,
  ];
}
