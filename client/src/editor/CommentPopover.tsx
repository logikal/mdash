/**
 * Comment popover: displays when a user clicks on a CriticMark comment range.
 *
 * Shows:
 *   - Parsed thread entries (author, timestamp, message)
 *   - Raw body as fallback if no threads are parsed
 *   - Input field to add a new reply
 *   - Dismiss button (X)
 *
 * Positioned absolutely near the comment text in the editor.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type { EditorView } from "@codemirror/view";
import type { CommentPopoverState } from "./comment-extension";
import { appendCommentEntry, closeCommentPopover, resolveComment } from "./comment-extension";

interface CommentPopoverProps {
  state: CommentPopoverState;
  viewRef: React.RefObject<EditorView | null>;
  username: string;
  editorContainerRef: React.RefObject<HTMLDivElement | null>;
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export default function CommentPopover({
  state,
  viewRef,
  username,
  editorContainerRef,
}: CommentPopoverProps) {
  // Reset reply text when a different comment opens by using the comment start
  // position as a key for the state. This avoids calling setState in an effect.
  const commentKey = state.open ? (state.comment?.start ?? 0) : -1;
  const [replyState, setReplyState] = useState({ key: commentKey, text: "" });
  if (replyState.key !== commentKey) {
    setReplyState({ key: commentKey, text: "" });
  }
  const replyText = replyState.text;
  const setReplyText = (text: string) => setReplyState({ key: commentKey, text });

  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Focus input when popover opens
  useEffect(() => {
    if (state.open) {
      // Small delay to allow render
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [state.open, state.comment?.start]);

  // Click outside to dismiss
  useEffect(() => {
    if (!state.open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        if (viewRef.current) {
          closeCommentPopover(viewRef.current);
        }
      }
    };

    // Delay adding the listener so the opening click doesn't immediately close
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [state.open, viewRef]);

  const handleSubmit = useCallback(() => {
    if (!replyText.trim() || !viewRef.current || !state.comment) return;
    appendCommentEntry(viewRef.current, state.comment, username, replyText.trim());
    setReplyState((prev) => ({ ...prev, text: "" }));
  }, [replyText, viewRef, state.comment, username]);

  const handleResolve = useCallback(() => {
    if (!viewRef.current || !state.comment) return;
    resolveComment(viewRef.current, state.comment);
  }, [viewRef, state.comment]);

  if (!state.open || !state.comment || !state.coords) return null;

  const { comment, coords } = state;

  // Compute position relative to the editor container.
  // Safe to read the ref here: this code only runs when the popover is visible,
  // and the container ref is stable (it doesn't drive re-renders).
  // eslint-disable-next-line react-hooks/refs
  const containerRect = editorContainerRef.current?.getBoundingClientRect();
  const left = containerRect ? coords.x - containerRect.left : coords.x;
  const top = containerRect ? coords.y - containerRect.top : coords.y;

  const hasThreads = comment.threads.length > 0;

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl"
      style={{
        left: `${Math.max(8, Math.min(left, (containerRect?.width ?? 600) - 330))}px`,
        top: `${top}px`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-xs font-medium text-gray-300">Comment</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleResolve}
            className="px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors
              text-green-400 hover:text-green-300 hover:bg-green-900/30
              border border-green-800/50 hover:border-green-700/50"
            title="Resolve comment (removes annotation)"
          >
            Resolve
          </button>
          <button
            onClick={() => {
              if (viewRef.current) closeCommentPopover(viewRef.current);
            }}
            className="text-gray-500 hover:text-gray-300 text-sm leading-none px-1"
            title="Close"
          >
            &#x2715;
          </button>
        </div>
      </div>

      {/* Thread entries */}
      <div className="max-h-60 overflow-y-auto">
        {hasThreads ? (
          comment.threads.map((thread, i) => (
            <div key={i} className="px-3 py-2 border-b border-gray-800/50 last:border-0">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-xs font-semibold text-blue-400">@{thread.user}</span>
                <span className="text-[10px] text-gray-500">
                  {formatTimestamp(thread.timestamp)}
                </span>
              </div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                {thread.message}
              </p>
            </div>
          ))
        ) : (
          <div className="px-3 py-2">
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
              {comment.body || "(empty comment)"}
            </p>
          </div>
        )}
      </div>

      {/* Reply input */}
      <div className="px-3 py-2 border-t border-gray-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Reply..."
            className="flex-1 bg-gray-800 text-sm text-gray-200 px-2 py-1.5
              rounded border border-gray-700 focus:border-blue-500
              focus:outline-none placeholder-gray-500
              font-mono"
            onKeyDown={(e) => {
              // Prevent CM6 from capturing keys while typing in the input
              e.stopPropagation();
              if (e.key === "Escape") {
                if (viewRef.current) closeCommentPopover(viewRef.current);
              }
            }}
          />
          <button
            type="submit"
            disabled={!replyText.trim()}
            className="px-2 py-1.5 text-xs font-medium rounded transition-colors
              text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/30
              border border-yellow-800/50 hover:border-yellow-700/50
              disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Reply
          </button>
        </form>
      </div>
    </div>
  );
}
