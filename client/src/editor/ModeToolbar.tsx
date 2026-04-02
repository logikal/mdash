/**
 * Mode toolbar: Edit / Suggest / View toggle.
 *
 * Displayed in the editor chrome. All three modes are functional.
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

        return (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`
              px-3 py-1 text-xs font-medium rounded transition-colors
              ${isActive
                ? "bg-gray-700 text-gray-100"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }
            `}
            title={`Switch to ${MODE_LABELS[m]} mode`}
          >
            {MODE_LABELS[m]}
          </button>
        );
      })}
    </div>
  );
}
