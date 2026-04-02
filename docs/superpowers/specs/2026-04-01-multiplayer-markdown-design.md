# Multiplayer Markdown — Design Spec

A self-hostable, real-time collaborative markdown editor. No auth. Google Docs-style collaboration on `.md` files.

Inspired by [mist](https://mist.inanimate.tech/) — but persistent, file-system backed, and self-hostable.

## Architecture

Three layers:

### Client

- React 19 + Vite + Tailwind CSS
- CodeMirror 6 as the editor core with inline markdown rendering (Obsidian-style hybrid — raw markdown with inline rendering of bold, headers, images, etc.)
- `y-codemirror.next` for Yjs integration (cursors, selections, sync)
- Mode switching, comment UI, and suggestion rendering via CM6 decorations and plugins

### WebSocket Server

- Node.js with Hono as the HTTP/WebSocket framework
- Acts as a Yjs collaboration relay — each document gets a Yjs room
- Syncs state between connected clients
- Periodically flushes Yjs doc state to disk as `.md` files
- Parses CriticMark on load, serializes CriticMark on save

### Storage

- Flat `.md` files in a configurable directory
- CriticMark syntax embedded inline for comments and suggestions
- Sidecar `.meta.json` files for document metadata (owner, created date)
- No database

```
storage/
  abc123.md
  abc123.meta.json    # {"owner": "logikal", "created": "2026-04-01T20:00:00Z"}
  def456.md
  def456.meta.json
```

## Data Flow

1. User opens `/{docId}` — client connects via WebSocket
2. Server loads `{docId}.md` from disk into a Yjs doc, parsing CriticMark into Yjs shared types
3. Clients sync via CRDT — all edits, suggestions, and comments flow through Yjs
4. On periodic flush (and on last client disconnect), server serializes Yjs doc back to `.md` with CriticMark and writes to disk
5. Shareable URL = `{BASE_URL}/{docId}`

## Editor Modes

Three modes, toggled via a toolbar. Each user picks their mode independently.

### Edit Mode

- Direct editing — changes go straight into the document
- All users in edit mode see each other's cursors and selections in real-time
- Cursor labels show the user's self-assigned username

### Suggest Mode

- Edits are wrapped in CriticMark syntax instead of applied directly:
  - Additions: `{++added text++}`
  - Deletions: `{--deleted text--}`
  - Substitutions: `{~~old~>new~~}`
- Rendered inline as colored additions/deletions (green highlight for additions, red strikethrough for deletions)
- Author attribution shown on each suggestion
- Other users can accept or reject each suggestion individually
- Accepting a suggestion applies the change to the document; rejecting removes the CriticMark wrapper

### View Mode

- Read-only — markdown rendered inline (headers, bold, links, etc.) but no editing
- Comments and suggestions still visible and interactive (can resolve comments, accept/reject suggestions)

## Comments & Highlights

- Select text in Edit or Suggest mode, click "Add comment" (or keyboard shortcut)
- Selected range gets a CriticMark comment annotation: `{>>comment text<<}`
- Comments rendered as a subtle background highlight on the text
- Clicking a highlight opens a popover/side thread showing:
  - Comment body
  - Author and timestamp
  - Threaded replies
- "Resolve" action removes the CriticMark annotation from the document
- Comments are stored inline in the `.md` via CriticMark — they survive download and re-import

## CriticMark Format

CriticMark is the standard used for embedding collaboration state in markdown files:

- Addition: `{++added text++}`
- Deletion: `{--deleted text--}`
- Substitution: `{~~old text~>new text~~}`
- Comment: `{>>comment text<<}`
- Highlight: `{==highlighted text==}`

This means the `.md` file is the single source of truth for both content and collaboration state. Files can be downloaded, edited externally, and re-imported with all suggestions and comments intact.

### CriticMark Extensions

Standard CriticMark doesn't support threaded replies, timestamps, or author attribution. We extend comments with structured metadata using a convention:

```
{>>@logikal 2026-04-01T20:00:00Z: This paragraph needs a citation
@alice 2026-04-01T20:05:00Z: Added one, PTAL<<}
```

- Each line in a comment block is a reply
- Format: `@username timestamp: message`
- The first line is the original comment; subsequent lines are replies
- This is plain text — external tools that don't understand the convention just see it as a comment body

Suggestion attribution follows a similar pattern — the author is embedded in the CriticMark:

```
{++@logikal: added text++}
```

## User Identity

- No authentication — fully trust-based
- Self-assigned username on first visit, stored in localStorage, editable anytime
- Username used for: cursor labels, comment attribution, suggestion attribution, document ownership
- Username persists across sessions via localStorage

## Document Management

### Homepage

- Minimal design (mist-inspired)
- "New document" button — creates a new doc and redirects to `/{docId}`
- Drag-and-drop zone for `.md` file import — parses existing CriticMark if present
- CLI upload command: `curl {BASE_URL}/new -T file.md`

### Document List (`/docs`)

- Lists all documents with: title (first `#` heading or filename), last modified date, active editor count
- Default filter: "My documents" (matching self-assigned username to owner in `.meta.json`)
- Toggle to show "All documents"
- Click a doc to open it

### Document URLs

- Format: `/{docId}` where `docId` is a short random slug (e.g., `abc123`)
- File on disk: `{STORAGE_DIR}/{docId}.md`

### Download

- Button in the editor toolbar to download the raw `.md` file
- CriticMark annotations included in the download (collaboration state preserved)

### Import

- Drag-and-drop on homepage or curl upload
- Existing CriticMark in the file is parsed and restored as live suggestions/comments

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend framework | React 19 | Ecosystem, CM6 integration |
| Bundler | Vite | Fast dev, simple config |
| Styling | Tailwind CSS | Utility-first, rapid UI development |
| Editor | CodeMirror 6 | Best-in-class extensible editor, markdown support |
| Collaboration | Yjs + y-codemirror.next | Battle-tested CRDT with CM6 bindings |
| WebSocket | y-websocket | Yjs WebSocket provider, handles rooms |
| Server | Node.js + Hono | Lightweight, handles both HTTP and WebSocket |
| Storage | Flat `.md` files + `.meta.json` sidecars | Simple, portable, no database |
| Deployment | Docker + Docker Compose | Self-hostable, volume-mountable storage |

## Deployment & Configuration

### Docker

- Single `Dockerfile` — multi-stage build (Node for server, Vite for client assets)
- Storage directory mounted as a Docker volume for persistence
- `docker-compose.yml` included for easy self-hosting

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE_DIR` | `./storage` | Path to the `.md` files directory |
| `PORT` | `3000` | Server port |
| `BASE_URL` | `http://localhost:3000` | For generating shareable links |

### Future Work (Not in v1)

- Tailscale integration for private network sharing
- Authentication layer (OAuth, etc.)
- Document expiration / retention policies
- Full-text search across documents
- Version history / git integration
