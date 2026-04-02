# Multiplayer Markdown Editor

A real-time collaborative markdown editor with CriticMark annotation support, powered by Yjs and WebSockets.

## Self-hosting with Docker Compose

1. Copy the example environment file and adjust as needed:

   ```sh
   cp .env.example .env
   ```

2. Start the service:

   ```sh
   docker compose up -d
   ```

3. Open `http://localhost:3000` in your browser.

Documents are persisted in a Docker volume (`app-data`). To use a host directory instead, replace the volume mount in `docker-compose.yml`:

```yaml
volumes:
  - ./my-data:/data
```

### Environment variables

| Variable      | Default                 | Description                              |
| ------------- | ----------------------- | ---------------------------------------- |
| `PORT`        | `3000`                  | Port the server listens on               |
| `STORAGE_DIR` | `/data`                 | Container path for document storage      |
| `BASE_URL`    | `http://localhost:3000` | Public URL for generating document links |

### Stopping

```sh
docker compose down
```

To also remove the data volume:

```sh
docker compose down -v
```
