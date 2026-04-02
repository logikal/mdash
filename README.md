# mdash

Real-time collaborative markdown editing. Multiple users connect to the same document over WebSockets, see each other's cursors, and edit simultaneously. Changes sync instantly via Yjs CRDTs.

**Editing modes:** Edit freely, suggest changes for review, or view read-only.

**Comments:** Threaded inline comments with @mentions and timestamps.

**CLI upload:** `curl -T doc.md https://your-instance/new`

## Development

```sh
cp .env.example .env
npm install
npm run dev
```

Client runs on `:5173`, server on `:3000`.

### Scripts

| Command                 | What it does                        |
| ----------------------- | ----------------------------------- |
| `npm run dev`           | Start client + server in watch mode |
| `npm run build`         | Build everything                    |
| `npm run lint`          | ESLint                              |
| `npm run format`        | Prettier (write)                    |
| `npm run typecheck`     | TypeScript check                    |
| `npm test`              | Unit tests                          |
| `npm run test:smoke`    | Smoke tests (needs running server)  |
| `npm run test:coverage` | Unit tests with coverage            |

## Self-hosting

```sh
cp .env.example .env
docker compose up -d
```

Open `http://localhost:3000`.

Documents persist in a Docker volume (`app-data`). To use a host directory instead:

```yaml
volumes:
  - ./my-data:/data
```

### Environment variables

| Variable      | Default                 | Description                   |
| ------------- | ----------------------- | ----------------------------- |
| `PORT`        | `3000`                  | Server port                   |
| `STORAGE_DIR` | `/data`                 | Document storage path         |
| `BASE_URL`    | `http://localhost:3000` | Public URL for document links |

### Stopping

```sh
docker compose down        # keep data
docker compose down -v     # remove data
```

## Contributing

CI runs lint, typecheck, tests, smoke tests, and Docker build on every PR. All checks must pass before merge.

To request a live preview deployment, comment `/deploy-preview` on a PR.
