import { useRef, useEffect, useState, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  rectangularSelection,
} from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";
import {
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { editorTheme, markdownHighlighting } from "./theme";
import { criticmarkDecorations } from "./criticmark-decorations";
import ModeToolbar from "./ModeToolbar";
import type { EditorMode } from "./modes";
import { setAwarenessMode } from "./modes";

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";

interface EditorProps {
  initialContent?: string;
  docId?: string;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected";

function getWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const config: Record<ConnectionStatus, { color: string; label: string }> = {
    connecting: { color: "bg-yellow-400", label: "Connecting..." },
    connected: { color: "bg-green-400", label: "Connected" },
    disconnected: { color: "bg-red-400", label: "Offline" },
  };

  const { color, label } = config[status];

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400 select-none">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      {label}
    </div>
  );
}

export default function Editor({ initialContent = "", docId }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [mode, setMode] = useState<EditorMode>("edit");

  const collaborative = Boolean(docId);

  // Sync mode changes to Yjs awareness
  const handleModeChange = useCallback(
    (newMode: EditorMode) => {
      setMode(newMode);
      if (providerRef.current) {
        setAwarenessMode(providerRef.current.awareness, newMode);
      }
    },
    [],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    // Shared base extensions (no keymap yet -- added per mode below)
    const baseExtensions = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      drawSelection(),
      rectangularSelection(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      highlightSelectionMatches(),
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
      }),
      editorTheme,
      markdownHighlighting,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      criticmarkDecorations,
    ];

    let ydoc: Y.Doc | undefined;
    let provider: WebsocketProvider | undefined;

    if (collaborative && docId) {
      // -- Yjs collaborative mode --
      ydoc = new Y.Doc();

      // y-websocket builds URL as `${serverUrl}/${roomname}?${params}`.
      // Server matches paths starting with /ws and reads `doc` from query params.
      provider = new WebsocketProvider(
        getWsUrl(),
        docId,
        ydoc,
        {
          connect: true,
          params: { doc: docId },
        }
      );
      providerRef.current = provider;

      // Set initial mode in awareness
      setAwarenessMode(provider.awareness, mode);

      provider.on("status", ({ status }: { status: string }) => {
        if (status === "connected") {
          setConnectionStatus("connected");
        } else if (status === "connecting") {
          setConnectionStatus("connecting");
        } else {
          setConnectionStatus("disconnected");
        }
      });

      provider.on("connection-close", () => {
        setConnectionStatus("disconnected");
      });

      const ytext = ydoc.getText("codemirror");

      const state = EditorState.create({
        extensions: [
          ...baseExtensions,
          yCollab(ytext, provider.awareness),
          keymap.of([
            ...defaultKeymap,
            ...yUndoManagerKeymap,
            ...closeBracketsKeymap,
            ...searchKeymap,
            indentWithTab,
          ]),
        ],
      });

      const view = new EditorView({
        state,
        parent: containerRef.current,
      });

      viewRef.current = view;
    } else {
      // -- Local-only fallback (no docId) --
      setConnectionStatus("disconnected");

      const state = EditorState.create({
        doc: initialContent,
        extensions: [
          ...baseExtensions,
          history(),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            ...closeBracketsKeymap,
            ...searchKeymap,
            indentWithTab,
          ]),
        ],
      });

      const view = new EditorView({
        state,
        parent: containerRef.current,
      });

      viewRef.current = view;
    }

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }

      if (provider) {
        provider.disconnect();
        provider.destroy();
      }
      providerRef.current = null;

      if (ydoc) {
        ydoc.destroy();
      }
    };
  }, [docId]);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Editor toolbar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-800 bg-gray-950">
        <ModeToolbar mode={mode} onModeChange={handleModeChange} />
        {collaborative && <ConnectionIndicator status={connectionStatus} />}
      </div>

      {/* Editor area */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden" />
    </div>
  );
}
