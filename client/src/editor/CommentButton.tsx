/**
 * Toolbar button: "Add Comment"
 *
 * Inserts a new CriticMark comment at the current cursor position or after
 * the current selection. Keyboard shortcut: Ctrl+Shift+M (handled by the
 * comment-extension keymap).
 */

import type { EditorView } from "@codemirror/view";
import { suggestModeField } from "./suggest-mode";

interface CommentButtonProps {
  viewRef: React.RefObject<EditorView | null>;
}

function addComment(view: EditorView): void {
  const { from, to } = view.state.selection.main;
  const smState = view.state.field(suggestModeField, false);
  const username = smState?.username || "anonymous";
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const commentText = `{>>@${username} ${timestamp}: <<}`;

  if (from === to) {
    // No selection: insert at cursor
    const cursorPos = from + commentText.length - 3;
    view.dispatch({
      changes: { from, to, insert: commentText },
      selection: { anchor: cursorPos },
    });
  } else {
    // Has selection: insert after selection
    const insertPos = to;
    const cursorPos = insertPos + commentText.length - 3;
    view.dispatch({
      changes: { from: insertPos, to: insertPos, insert: commentText },
      selection: { anchor: cursorPos },
    });
  }

  view.focus();
}

export default function CommentButton({ viewRef }: CommentButtonProps) {
  return (
    <button
      onClick={() => {
        if (viewRef.current) addComment(viewRef.current);
      }}
      className="px-2 py-1 text-xs font-medium rounded transition-colors
        text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/30
        border border-yellow-800/50 hover:border-yellow-700/50"
      title="Add comment (Ctrl+Shift+M)"
    >
      + Comment
    </button>
  );
}
