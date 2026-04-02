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

const SAMPLE_CONTENT = `# Welcome to Multiplayer Markdown

A real-time collaborative markdown editor. Start typing to edit.

## Features

- **Real-time collaboration** with multiple cursors
- *Inline markdown rendering* as you type
- Support for \`code blocks\` and more

### Code Example

\`\`\`js
function hello() {
  console.log("Hello, markdown!");
}
\`\`\`

> Blockquotes render with subtle styling

---

This is a [link example](https://example.com) and some ~~strikethrough~~ text.

1. Ordered lists
2. Work too
3. Just like this
`;

export default function Editor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: SAMPLE_CONTENT,
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
