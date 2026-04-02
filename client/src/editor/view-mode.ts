/**
 * CodeMirror 6 extension for View mode.
 *
 * When active, makes the editor read-only with a clean reading experience:
 *   - Editor is set to readOnly
 *   - Cursor is hidden
 *   - Active line highlighting is suppressed
 *   - No editing affordances shown
 *
 * CriticMark decorations remain visible and interactive (for M4 features).
 */

import { StateField, StateEffect, type Extension, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/** Effect to toggle view mode on/off. */
export const viewModeEffect = StateEffect.define<boolean>();

/** StateField tracking whether view mode is active. */
export const viewModeField = StateField.define<boolean>({
  create() {
    return false;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(viewModeEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

/**
 * Theme overrides applied when view mode is active.
 * Hides cursor and removes editing visual cues.
 */
const viewModeTheme = EditorView.theme({
  "&.cm-view-mode .cm-cursor, &.cm-view-mode .cm-dropCursor": {
    display: "none !important",
  },
  "&.cm-view-mode .cm-activeLine": {
    backgroundColor: "transparent",
  },
  "&.cm-view-mode .cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "#4b5563",
  },
  // Slightly widen content area for comfortable reading
  "&.cm-view-mode .cm-content": {
    caretColor: "transparent",
  },
});

/** Compartment for dynamically toggling readOnly. */
const readOnlyCompartment = new Compartment();

/**
 * ViewPlugin that syncs the viewModeField to the editor DOM class
 * and reconfigures readOnly dynamically.
 */
const viewModeUpdater = EditorView.updateListener.of((update) => {
  const isViewMode = update.state.field(viewModeField);
  const wasViewMode = update.startState.field(viewModeField, false) ?? false;

  // Toggle the CSS class on the editor root
  if (isViewMode !== wasViewMode) {
    if (isViewMode) {
      update.view.dom.classList.add("cm-view-mode");
    } else {
      update.view.dom.classList.remove("cm-view-mode");
    }

    // Reconfigure readOnly
    update.view.dispatch({
      effects: readOnlyCompartment.reconfigure(isViewMode ? EditorView.editable.of(false) : []),
    });
  }
});

/**
 * Returns the view mode extension bundle.
 * Add this to your editor's extensions array.
 */
export function viewMode(): Extension {
  return [viewModeField, viewModeTheme, viewModeUpdater, readOnlyCompartment.of([])];
}
