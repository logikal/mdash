/**
 * Editor mode types and awareness integration.
 *
 * Three modes: Edit, Suggest, View.
 * Mode is per-user, stored in component state, and synced via Yjs awareness
 * so other users can see what mode each participant is in.
 */

export type EditorMode = "edit" | "suggest" | "view";

export const MODE_LABELS: Record<EditorMode, string> = {
  edit: "Edit",
  suggest: "Suggest",
  view: "View",
};

/**
 * Set the local user's mode in the Yjs awareness state.
 */
export function setAwarenessMode(
  awareness: {
    getLocalState: () => Record<string, unknown> | null;
    setLocalState: (state: Record<string, unknown>) => void;
  },
  mode: EditorMode,
): void {
  const current = awareness.getLocalState() ?? {};
  awareness.setLocalState({ ...current, mode });
}
