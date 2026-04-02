import { useRef, useEffect } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { editorTheme, markdownHighlighting } from "./theme";

interface EditorProps {
  initialContent?: string;
  docId?: string;
}

export default function Editor({ initialContent = "", docId }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        // Core editing
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        rectangularSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        history(),
        highlightSelectionMatches(),

        // Keymaps
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...closeBracketsKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),

        // Markdown language with code block highlighting
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
        }),

        // Theme & highlighting
        editorTheme,
        markdownHighlighting,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 overflow-hidden"
    />
  );
}
