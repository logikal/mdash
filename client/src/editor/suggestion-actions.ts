/**
 * CodeMirror 6 extension for accept/reject UI on CriticMark suggestions.
 *
 * Adds small inline widget buttons (checkmark/X) after each CriticMark
 * addition, deletion, or substitution annotation. Clicking accept or reject
 * resolves the suggestion by transforming the document text.
 *
 * Accept/reject semantics:
 *   Accept addition  {++text++}      -> text
 *   Reject addition  {++text++}      -> (removed)
 *   Accept deletion  {--text--}      -> (removed)
 *   Reject deletion  {--text--}      -> text
 *   Accept substitution {~~old~>new~~} -> new
 *   Reject substitution {~~old~>new~~} -> old
 */

import {
  ViewPlugin,
  Decoration,
  WidgetType,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// ---------------------------------------------------------------------------
// Regex for CriticMark suggestions (additions, deletions, substitutions only)
// ---------------------------------------------------------------------------

const SUGGESTION_RE = /\{\+\+([\s\S]*?)\+\+\}|\{--([\s\S]*?)--\}|\{~~([\s\S]*?)~>([\s\S]*?)~~\}/g;

// ---------------------------------------------------------------------------
// Parse author prefix from content (e.g. "@user: actual text" -> "actual text")
// ---------------------------------------------------------------------------

function stripAuthorPrefix(raw: string): string {
  const m = raw.match(/^@[^:]+:\s*([\s\S]*)$/);
  return m ? m[1] : raw;
}

// ---------------------------------------------------------------------------
// Types for suggestion info attached to widgets
// ---------------------------------------------------------------------------

interface SuggestionInfo {
  type: "addition" | "deletion" | "substitution";
  /** Absolute start of the entire CriticMark annotation in the doc */
  from: number;
  /** Absolute end of the entire CriticMark annotation in the doc */
  to: number;
  /** Text to insert when accepted */
  acceptText: string;
  /** Text to insert when rejected */
  rejectText: string;
}

// ---------------------------------------------------------------------------
// Widget: accept/reject button pair
// ---------------------------------------------------------------------------

class SuggestionActionWidget extends WidgetType {
  constructor(readonly info: SuggestionInfo) {
    super();
  }

  eq(other: SuggestionActionWidget): boolean {
    return (
      this.info.from === other.info.from &&
      this.info.to === other.info.to &&
      this.info.type === other.info.type
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement("span");
    container.className = "cm-suggestion-actions";
    container.setAttribute("aria-label", "Suggestion actions");

    const acceptBtn = document.createElement("button");
    acceptBtn.className = "cm-suggestion-accept";
    acceptBtn.textContent = "\u2713"; // checkmark
    acceptBtn.title = "Accept suggestion";
    acceptBtn.setAttribute("aria-label", "Accept suggestion");
    acceptBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      resolveSuggestion(view, this.info, "accept");
    });

    const rejectBtn = document.createElement("button");
    rejectBtn.className = "cm-suggestion-reject";
    rejectBtn.textContent = "\u2717"; // X mark
    rejectBtn.title = "Reject suggestion";
    rejectBtn.setAttribute("aria-label", "Reject suggestion");
    rejectBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      resolveSuggestion(view, this.info, "reject");
    });

    container.appendChild(acceptBtn);
    container.appendChild(rejectBtn);
    return container;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Resolve a single suggestion
// ---------------------------------------------------------------------------

function resolveSuggestion(
  view: EditorView,
  info: SuggestionInfo,
  action: "accept" | "reject",
): void {
  const replacement = action === "accept" ? info.acceptText : info.rejectText;
  view.dispatch({
    changes: { from: info.from, to: info.to, insert: replacement },
  });
}

// ---------------------------------------------------------------------------
// Build decorations: scan for suggestions, add widget after each
// ---------------------------------------------------------------------------

function buildSuggestionDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  for (const { from, to } of view.visibleRanges) {
    const lineFrom = doc.lineAt(from).from;
    const lineTo = doc.lineAt(to).to;
    const text = doc.sliceString(lineFrom, lineTo);

    SUGGESTION_RE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = SUGGESTION_RE.exec(text)) !== null) {
      const absStart = lineFrom + match.index;
      const absEnd = absStart + match[0].length;

      let info: SuggestionInfo;

      if (match[1] !== undefined) {
        // Addition: {++content++}
        const content = stripAuthorPrefix(match[1]);
        info = {
          type: "addition",
          from: absStart,
          to: absEnd,
          acceptText: content,
          rejectText: "",
        };
      } else if (match[2] !== undefined) {
        // Deletion: {--content--}
        const content = stripAuthorPrefix(match[2]);
        info = {
          type: "deletion",
          from: absStart,
          to: absEnd,
          acceptText: "",
          rejectText: content,
        };
      } else if (match[3] !== undefined && match[4] !== undefined) {
        // Substitution: {~~old~>new~~}
        info = {
          type: "substitution",
          from: absStart,
          to: absEnd,
          acceptText: match[4],
          rejectText: match[3],
        };
      } else {
        continue;
      }

      // Place widget decoration at the end of the annotation
      builder.add(
        absEnd,
        absEnd,
        Decoration.widget({
          widget: new SuggestionActionWidget(info),
          side: 1,
        }),
      );
    }
  }

  return builder.finish();
}

// ---------------------------------------------------------------------------
// ViewPlugin
// ---------------------------------------------------------------------------

export const suggestionActions = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildSuggestionDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildSuggestionDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

// ---------------------------------------------------------------------------
// Bulk operations: accept all / reject all
// ---------------------------------------------------------------------------

/**
 * Find all CriticMark suggestions in the full document and resolve them.
 * Must process from end to start to avoid offset shifting.
 */
export function resolveAllSuggestions(view: EditorView, action: "accept" | "reject"): void {
  const doc = view.state.doc;
  const text = doc.toString();

  SUGGESTION_RE.lastIndex = 0;
  const suggestions: SuggestionInfo[] = [];
  let match: RegExpExecArray | null;

  while ((match = SUGGESTION_RE.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;

    if (match[1] !== undefined) {
      const content = stripAuthorPrefix(match[1]);
      suggestions.push({
        type: "addition",
        from,
        to,
        acceptText: content,
        rejectText: "",
      });
    } else if (match[2] !== undefined) {
      const content = stripAuthorPrefix(match[2]);
      suggestions.push({
        type: "deletion",
        from,
        to,
        acceptText: "",
        rejectText: content,
      });
    } else if (match[3] !== undefined && match[4] !== undefined) {
      suggestions.push({
        type: "substitution",
        from,
        to,
        acceptText: match[4],
        rejectText: match[3],
      });
    }
  }

  if (suggestions.length === 0) return;

  // Build changes from end to start so offsets don't shift
  const changes = suggestions
    .sort((a, b) => b.from - a.from)
    .map((s) => ({
      from: s.from,
      to: s.to,
      insert: action === "accept" ? s.acceptText : s.rejectText,
    }));

  view.dispatch({ changes });
}
