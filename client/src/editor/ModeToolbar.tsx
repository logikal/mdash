/**
 * Mode toolbar: Edit / Suggest / View toggle.
 *
 * Displayed in the editor chrome. Suggest and View are shown but disabled
 * until their respective issues are implemented.
 */

import type { EditorMode } from "./modes";
import { MODE_LABELS } from "./modes";

interface ModeToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
}

const MODE_ORDER: EditorMode[] = ["edit", "suggest", "view"];

export default function ModeToolbar({ mode, onModeChange }: ModeToolbarProps) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-900 rounded-md p-0.5 border border-gray-800">
      {MODE_ORDER.map((m) => {
        const isActive = m === mode;
        // Suggest and View are not yet implemented - show but disable
        const isDisabled = m === "suggest" || m === "view";

        return (
          <button
            key={m}
            onClick={() => !isDisabled && onModeChange(m)}
            disabled={isDisabled}
            className={`
              px-3 py-1 text-xs font-medium rounded transition-colors
              ${isActive
                ? "bg-gray-700 text-gray-100"
                : isDisabled
                  ? "text-gray-600 cursor-not-allowed"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }
            `}
            title={
              isDisabled
                ? `${MODE_LABELS[m]} mode coming soon`
                : `Switch to ${MODE_LABELS[m]} mode`
            }
          >
            {MODE_LABELS[m]}
          </button>
        );
      })}
    </div>
  );
}
