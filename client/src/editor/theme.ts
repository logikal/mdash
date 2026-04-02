import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/**
 * Dark editor theme matching the app's Tailwind design.
 * Uses gray-950 background, gray-100 text, JetBrains Mono font.
 */
export const editorTheme = EditorView.theme(
  {
    "&": {
      color: "#f3f4f6", // gray-100
      backgroundColor: "#030712", // gray-950
      fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
      fontSize: "15px",
      height: "100%",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-content": {
      caretColor: "#60a5fa", // blue-400
      padding: "1rem 0",
      maxWidth: "72ch",
      margin: "0 auto",
      lineHeight: "1.7",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#60a5fa",
      borderLeftWidth: "2px",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "#1e3a5f",
    },
    ".cm-activeLine": {
      backgroundColor: "#0d1117",
    },
    ".cm-gutters": {
      backgroundColor: "#030712",
      color: "#4b5563", // gray-600
      border: "none",
      paddingRight: "8px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#0d1117",
      color: "#9ca3af", // gray-400
    },
    ".cm-scroller": {
      overflow: "auto",
    },
    // Inline markdown rendering styles
    ".cm-header-1": {
      fontSize: "2em",
      fontWeight: "700",
      lineHeight: "1.3",
      color: "#f9fafb",
    },
    ".cm-header-2": {
      fontSize: "1.5em",
      fontWeight: "600",
      lineHeight: "1.4",
      color: "#f3f4f6",
    },
    ".cm-header-3": {
      fontSize: "1.25em",
      fontWeight: "600",
      lineHeight: "1.5",
      color: "#e5e7eb",
    },
    ".cm-header-4": {
      fontSize: "1.1em",
      fontWeight: "600",
      color: "#d1d5db",
    },
    ".cm-header-5": {
      fontSize: "1.05em",
      fontWeight: "600",
      color: "#d1d5db",
    },
    ".cm-header-6": {
      fontSize: "1em",
      fontWeight: "600",
      color: "#9ca3af",
    },

    // CriticMark decoration styles
    ".cm-criticmark-addition": {
      backgroundColor: "rgba(34, 197, 94, 0.15)", // green-500/15
      color: "#86efac", // green-300
      borderRadius: "2px",
      padding: "0 1px",
    },
    ".cm-criticmark-deletion": {
      backgroundColor: "rgba(239, 68, 68, 0.15)", // red-500/15
      color: "#fca5a5", // red-300
      textDecoration: "line-through",
      borderRadius: "2px",
      padding: "0 1px",
    },
    ".cm-criticmark-substitution-old": {
      backgroundColor: "rgba(239, 68, 68, 0.15)",
      color: "#fca5a5",
      textDecoration: "line-through",
      borderRadius: "2px",
      padding: "0 1px",
    },
    ".cm-criticmark-substitution-new": {
      backgroundColor: "rgba(34, 197, 94, 0.15)",
      color: "#86efac",
      borderRadius: "2px",
      padding: "0 1px",
    },
    ".cm-criticmark-comment": {
      backgroundColor: "rgba(234, 179, 8, 0.15)", // yellow-500/15
      color: "#fde68a", // yellow-200
      borderRadius: "2px",
      padding: "0 1px",
    },
    ".cm-criticmark-highlight": {
      backgroundColor: "rgba(168, 85, 247, 0.15)", // purple-500/15
      color: "#d8b4fe", // purple-300
      borderRadius: "2px",
      padding: "0 1px",
    },
    ".cm-criticmark-delim": {
      color: "#4b5563", // gray-600 - dim the delimiters
      fontSize: "0.85em",
    },

    // Remote cursor styles (y-codemirror.next overrides for dark theme)
    ".cm-ySelectionCaret": {
      position: "relative",
      borderLeft: "2px solid",
      borderRight: "none",
      marginLeft: "-1px",
      marginRight: "-1px",
      boxSizing: "border-box",
      display: "inline",
    },
    ".cm-ySelectionCaretDot": {
      borderRadius: "50%",
      position: "absolute",
      width: ".5em",
      height: ".5em",
      top: "-.25em",
      left: "-.25em",
      backgroundColor: "inherit",
      transition: "transform .3s ease-in-out",
      boxSizing: "border-box",
    },
    ".cm-ySelectionCaret:hover > .cm-ySelectionCaretDot": {
      transformOrigin: "bottom center",
      transform: "scale(0)",
    },
    ".cm-ySelectionInfo": {
      position: "absolute",
      top: "-1.2em",
      left: "-1px",
      fontSize: ".7em",
      fontFamily:
        '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
      fontStyle: "normal",
      fontWeight: "600",
      lineHeight: "normal",
      userSelect: "none",
      color: "#030712",
      paddingLeft: "4px",
      paddingRight: "4px",
      paddingTop: "1px",
      paddingBottom: "1px",
      borderRadius: "3px",
      zIndex: 101,
      transition: "opacity .3s ease-in-out",
      backgroundColor: "inherit",
      opacity: 0,
      transitionDelay: "0s",
      whiteSpace: "nowrap",
    },
    ".cm-ySelectionCaret:hover > .cm-ySelectionInfo": {
      opacity: 1,
      transitionDelay: "0s",
    },
  },
  { dark: true },
);

/**
 * Syntax highlighting for markdown content.
 * Renders bold as bold, italic as italic, code as code, etc.
 */
export const markdownHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    // Headings - styled via .cm-header-N classes above
    { tag: tags.heading1, class: "cm-header-1" },
    { tag: tags.heading2, class: "cm-header-2" },
    { tag: tags.heading3, class: "cm-header-3" },
    { tag: tags.heading4, class: "cm-header-4" },
    { tag: tags.heading5, class: "cm-header-5" },
    { tag: tags.heading6, class: "cm-header-6" },

    // Emphasis
    { tag: tags.emphasis, fontStyle: "italic", color: "#e2e8f0" },
    { tag: tags.strong, fontWeight: "bold", color: "#f1f5f9" },
    { tag: tags.strikethrough, textDecoration: "line-through", color: "#6b7280" },

    // Code
    {
      tag: tags.monospace,
      fontFamily: '"JetBrains Mono", monospace',
      backgroundColor: "#1e293b",
      color: "#7dd3fc", // sky-300
      borderRadius: "3px",
      padding: "1px 4px",
    },

    // Links
    { tag: tags.link, color: "#60a5fa", textDecoration: "underline" },
    { tag: tags.url, color: "#60a5fa" },

    // Lists
    { tag: tags.list, color: "#9ca3af" },

    // Quotes
    { tag: tags.quote, color: "#a1a1aa", fontStyle: "italic" },

    // Meta / markup characters (##, **, etc.)
    { tag: tags.processingInstruction, color: "#4b5563" },
    { tag: tags.meta, color: "#4b5563" },

    // Horizontal rule
    { tag: tags.contentSeparator, color: "#4b5563" },

    // HTML tags in markdown
    { tag: tags.angleBracket, color: "#4b5563" },
    { tag: tags.tagName, color: "#7dd3fc" },
    { tag: tags.attributeName, color: "#a78bfa" },
    { tag: tags.attributeValue, color: "#86efac" },
  ]),
);
