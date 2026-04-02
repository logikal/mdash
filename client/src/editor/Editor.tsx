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
  type ViewUpdate,
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
import { suggestMode, setSuggestModeEffect } from "./suggest-mode";
import { suggestionActions } from "./suggestion-actions";
import { viewMode, viewModeEffect } from "./view-mode";
import {
  commentExtension,
  commentPopoverField,
  type CommentPopoverState,
} from "./comment-extension";
import ModeToolbar from "./ModeToolbar";
import SuggestionToolbar from "./SuggestionToolbar";
import CommentButton from "./CommentButton";
import CommentPopover from "./CommentPopover";
import type { EditorMode } from "./modes";
import { setAwarenessMode } from "./modes";
import UsernamePrompt from "./UsernamePrompt";
import UserPresence from "./UserPresence";
import {
  getStoredUsername,
  setStoredUsername,
  generateAnonName,
  setAwarenessUser,
} from "./user-awareness";

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";

interface EditorProps {
  initialContent?: string;
  docId?: string;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface RemoteUser {
  name: string;
  color: string;
}

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

  // Username state
  const [username, setUsername] = useState<string | null>(
    () => getStoredUsername(),
  );
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(
    () => !getStoredUsername(),
  );
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [commentPopover, setCommentPopover] = useState<CommentPopoverState>({
    open: false,
    comment: null,
    coords: null,
  });
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  const collaborative = Boolean(docId);

  // Handle username submission (from prompt or edit)
  const handleUsernameSubmit = useCallback(
    (name: string) => {
      setUsername(name);
      setStoredUsername(name);
      setShowUsernamePrompt(false);
      if (providerRef.current) {
        setAwarenessUser(providerRef.current.awareness, name);
      }
      // Update the CM6 suggest-mode field with the new username
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: setSuggestModeEffect.of({ username: name }),
        });
      }
    },
    [],
  );

  // Sync mode changes to Yjs awareness + CM6 suggest-mode state
  const handleModeChange = useCallback(
    (newMode: EditorMode) => {
      setMode(newMode);
      if (providerRef.current) {
        setAwarenessMode(providerRef.current.awareness, newMode);
      }
      // Update the CM6 suggest-mode field
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: [
            setSuggestModeEffect.of({ mode: newMode }),
            viewModeEffect.of(newMode === "view"),
          ],
        });
      }
    },
    [],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    // Don't create editor until we have a username
    if (!username) return;

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
      suggestionActions,
      suggestMode(),
      viewMode(),
      commentExtension(),
      // Sync comment popover state from CM6 to React
      EditorView.updateListener.of((update: ViewUpdate) => {
        const popState = update.state.field(commentPopoverField, false);
        if (popState) {
          setCommentPopover((prev) => {
            // Only update if something changed
            if (
              prev.open !== popState.open ||
              prev.comment?.start !== popState.comment?.start
            ) {
              return popState;
            }
            return prev;
          });
        }
      }),
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

      // Set user info in awareness
      setAwarenessUser(provider.awareness, username);

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

      // Track remote users via awareness
      const updateRemoteUsers = () => {
        if (!provider) return;
        const states = provider.awareness.getStates();
        const localClientId = provider.awareness.clientID;
        const users: RemoteUser[] = [];
        states.forEach((state, clientId) => {
          if (clientId === localClientId) return;
          if (state.user?.name) {
            users.push({
              name: state.user.name,
              color: state.user.color || "#60a5fa",
            });
          }
        });
        setRemoteUsers(users);
      };

      provider.awareness.on("change", updateRemoteUsers);
      // Initial population
      updateRemoteUsers();

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

      // Set initial mode state (suggest-mode + view-mode + username)
      view.dispatch({
        effects: [
          setSuggestModeEffect.of({ mode, username }),
          viewModeEffect.of(mode === "view"),
        ],
      });
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

      // Set initial mode state (suggest-mode + view-mode + username)
      view.dispatch({
        effects: [
          setSuggestModeEffect.of({ mode, username }),
          viewModeEffect.of(mode === "view"),
        ],
      });
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
  }, [docId, username]);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Username prompt modal */}
      {showUsernamePrompt && (
        <UsernamePrompt
          defaultValue={username || generateAnonName()}
          onSubmit={handleUsernameSubmit}
        />
      )}

      {/* Editor toolbar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-800 bg-gray-950">
        <div className="flex items-center gap-3">
          <ModeToolbar mode={mode} onModeChange={handleModeChange} />
          <SuggestionToolbar viewRef={viewRef} />
          <CommentButton viewRef={viewRef} />
        </div>
        <div className="flex items-center gap-3">
          {collaborative && username && (
            <UserPresence
              username={username}
              remoteUsers={remoteUsers}
              onEditUsername={() => setShowUsernamePrompt(true)}
            />
          )}
          {collaborative && <ConnectionIndicator status={connectionStatus} />}
        </div>
      </div>

      {/* Editor area with comment popover */}
      <div ref={editorWrapperRef} className="relative flex-1 min-h-0 overflow-hidden">
        <div ref={containerRef} className="h-full overflow-hidden" />
        <CommentPopover
          state={commentPopover}
          viewRef={viewRef}
          username={username || "anonymous"}
          editorContainerRef={editorWrapperRef}
        />
      </div>
    </div>
  );
}
