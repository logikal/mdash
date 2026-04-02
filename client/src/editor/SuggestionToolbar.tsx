/**
 * Accept All / Reject All toolbar for bulk suggestion resolution.
 *
 * Shown in the editor chrome alongside the mode toolbar.
 */

import type { EditorView } from "@codemirror/view";
import { resolveAllSuggestions } from "./suggestion-actions";

interface SuggestionToolbarProps {
  viewRef: React.RefObject<EditorView | null>;
}

export default function SuggestionToolbar({ viewRef }: SuggestionToolbarProps) {
  const handleAcceptAll = () => {
    if (viewRef.current) {
      resolveAllSuggestions(viewRef.current, "accept");
    }
  };

  const handleRejectAll = () => {
    if (viewRef.current) {
      resolveAllSuggestions(viewRef.current, "reject");
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleAcceptAll}
        className="px-2 py-1 text-xs font-medium rounded transition-colors
          text-green-400 hover:text-green-300 hover:bg-green-900/30
          border border-green-800/50 hover:border-green-700/50"
        title="Accept all suggestions"
      >
        &#x2713; Accept all
      </button>
      <button
        onClick={handleRejectAll}
        className="px-2 py-1 text-xs font-medium rounded transition-colors
          text-red-400 hover:text-red-300 hover:bg-red-900/30
          border border-red-800/50 hover:border-red-700/50"
        title="Reject all suggestions"
      >
        &#x2717; Reject all
      </button>
    </div>
  );
}
