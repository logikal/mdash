/**
 * CodeMirror 6 extension that renders CriticMark annotations as inline
 * decorations in Edit mode. The annotations remain editable as normal text;
 * they're simply styled with colored backgrounds to distinguish them visually.
 *
 * Supported:
 *   {++addition++}      -> green background
 *   {--deletion--}      -> red background with strikethrough
 *   {~~old~>new~~}      -> red on old, green on new
 *   {>>comment<<}       -> yellow background
 *   {==highlight==}     -> purple background
 */

import {
  ViewPlugin,
  Decoration,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// ---------------------------------------------------------------------------
// Decoration marks
// ---------------------------------------------------------------------------

const additionMark = Decoration.mark({
  class: "cm-criticmark-addition",
});

const additionDelimMark = Decoration.mark({
  class: "cm-criticmark-delim cm-criticmark-addition-delim",
});

const deletionMark = Decoration.mark({
  class: "cm-criticmark-deletion",
});

const deletionDelimMark = Decoration.mark({
  class: "cm-criticmark-delim cm-criticmark-deletion-delim",
});

const substitutionOldMark = Decoration.mark({
  class: "cm-criticmark-substitution-old",
});

const substitutionNewMark = Decoration.mark({
  class: "cm-criticmark-substitution-new",
});

const substitutionDelimMark = Decoration.mark({
  class: "cm-criticmark-delim cm-criticmark-substitution-delim",
});

const substitutionArrowMark = Decoration.mark({
  class: "cm-criticmark-delim cm-criticmark-substitution-arrow",
});

const commentMark = Decoration.mark({
  class: "cm-criticmark-comment",
});

const commentDelimMark = Decoration.mark({
  class: "cm-criticmark-delim cm-criticmark-comment-delim",
});

const highlightMark = Decoration.mark({
  class: "cm-criticmark-highlight",
});

const highlightDelimMark = Decoration.mark({
  class: "cm-criticmark-delim cm-criticmark-highlight-delim",
});

// ---------------------------------------------------------------------------
// Regex matching CriticMark (same pattern used in the shared parser)
// ---------------------------------------------------------------------------

const CRITIC_RE =
  /\{\+\+([\s\S]*?)\+\+\}|\{--([\s\S]*?)--\}|\{~~([\s\S]*?)~>([\s\S]*?)~~\}|\{>>([\s\S]*?)<<\}|\{==([\s\S]*?)==\}/g;

// ---------------------------------------------------------------------------
// Build decorations from the visible document text
// ---------------------------------------------------------------------------

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  // For efficiency, only scan visible ranges
  for (const { from, to } of view.visibleRanges) {
    // Expand range to full lines
    const lineFrom = doc.lineAt(from).from;
    const lineTo = doc.lineAt(to).to;
    const text = doc.sliceString(lineFrom, lineTo);

    CRITIC_RE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = CRITIC_RE.exec(text)) !== null) {
      const absStart = lineFrom + match.index;
      const absEnd = absStart + match[0].length;

      if (match[1] !== undefined) {
        // Addition: {++content++}
        const openEnd = absStart + 3; // {++
        const closeStart = absEnd - 3; // ++}
        builder.add(absStart, openEnd, additionDelimMark);
        if (openEnd < closeStart) {
          builder.add(openEnd, closeStart, additionMark);
        }
        builder.add(closeStart, absEnd, additionDelimMark);
      } else if (match[2] !== undefined) {
        // Deletion: {--content--}
        const openEnd = absStart + 3;
        const closeStart = absEnd - 3;
        builder.add(absStart, openEnd, deletionDelimMark);
        if (openEnd < closeStart) {
          builder.add(openEnd, closeStart, deletionMark);
        }
        builder.add(closeStart, absEnd, deletionDelimMark);
      } else if (match[3] !== undefined && match[4] !== undefined) {
        // Substitution: {~~old~>new~~}
        const openEnd = absStart + 3; // {~~
        const oldContent = match[3];
        const oldEnd = openEnd + oldContent.length;
        const arrowEnd = oldEnd + 2; // ~>
        const newContent = match[4];
        const newEnd = arrowEnd + newContent.length;
        // newEnd should be absEnd - 3 (for ~~})

        builder.add(absStart, openEnd, substitutionDelimMark);
        if (oldContent.length > 0) {
          builder.add(openEnd, oldEnd, substitutionOldMark);
        }
        builder.add(oldEnd, arrowEnd, substitutionArrowMark);
        if (newContent.length > 0) {
          builder.add(arrowEnd, newEnd, substitutionNewMark);
        }
        builder.add(newEnd, absEnd, substitutionDelimMark);
      } else if (match[5] !== undefined) {
        // Comment: {>>body<<}
        const openEnd = absStart + 3;
        const closeStart = absEnd - 3;
        builder.add(absStart, openEnd, commentDelimMark);
        if (openEnd < closeStart) {
          builder.add(openEnd, closeStart, commentMark);
        }
        builder.add(closeStart, absEnd, commentDelimMark);
      } else if (match[6] !== undefined) {
        // Highlight: {==content==}
        const openEnd = absStart + 3;
        const closeStart = absEnd - 3;
        builder.add(absStart, openEnd, highlightDelimMark);
        if (openEnd < closeStart) {
          builder.add(openEnd, closeStart, highlightMark);
        }
        builder.add(closeStart, absEnd, highlightDelimMark);
      }
    }
  }

  return builder.finish();
}

// ---------------------------------------------------------------------------
// ViewPlugin
// ---------------------------------------------------------------------------

export const criticmarkDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);
