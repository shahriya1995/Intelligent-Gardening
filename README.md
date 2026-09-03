# Open Gardener

An open, model-independent gardening planner, scheduler, and cited knowledge service designed to work with Open WebUI, any MCP client, or any HTTP client.

## Architecture

- **Open WebUI** is the multi-user chat interface and model gateway. Users can connect Ollama or another OpenAI-compatible provider.
- **Gardener API** is a TypeScript/Express service exposing REST/OpenAPI tools at port `8000`.
- **Gardener MCP** uses the TypeScript MCP SDK and exposes the same operations over Streamable HTTP at port `8001`.
- **SQLite** stores gardens, tasks, and source-attributed knowledge for the first version.
- Retrieval starts with portable lexical ranking. Its stable service boundary lets us add embeddings and pgvector without changing clients.

The language model is deliberately not embedded in the gardening service. Open WebUI—or another client—chooses the model and calls these tools.

## Isolated clients

This project runs its own Open WebUI at `http://localhost:5000`. The sibling `open-webui-mcp` project remains at `http://localhost:3000`. They use separate Docker networks and data volumes, so their accounts, settings, and tool registrations do not cross project boundaries.

## Run this gardening project

```bash
docker compose up -d --build
```

## Connect the gardening tools to Open WebUI

### Recommended: OpenAPI

In Open WebUI, add a global OpenAPI tool server:

- URL inside Compose: `http://gardener-api:8000`
- Spec path: `openapi.json`
- Authentication: Bearer token matching `GARDEN_API_KEY`

The OpenAPI route is easiest to share and also works with non-MCP clients.

### Native MCP

On Open WebUI 0.6.31 or later, an admin can add a Streamable HTTP MCP server:

- URL inside Compose: `http://gardener-mcp:8001/mcp`

MCP server registration is admin-only in Open WebUI. Set a persistent `WEBUI_SECRET_KEY` before production use.

## HTTP examples

```bash
curl -H 'Authorization: Bearer change-me' http://localhost:8100/gardens

curl -X POST http://localhost:8100/gardens \
  -H 'Authorization: Bearer change-me' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Backyard","location":"Portland, OR","hardiness_zone":"8b"}'
```

The OpenAPI specification is available from the host at `http://localhost:8100/openapi.json`.

## TypeScript development

Requires Node.js 22 or newer (the database uses Node's built-in SQLite module).

```bash
npm install
npm run typecheck
npm test
npm run dev
```

## Development roadmap

1. Add accounts/tenant isolation and PostgreSQL migrations.
2. Build licensed document ingestion, chunking, deduplication, and provenance checks.
3. Add configurable embedding providers and hybrid pgvector search.
4. Generate climate-aware planting plans using weather and frost-date sources.
5. Add reminders, observations, photo attachments, and cautious disease triage.

Do not expose this first scaffold publicly yet: its shared database and single API key are intended for local development.
