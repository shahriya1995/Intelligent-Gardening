# Intelligent Gardening

Intelligent Gardening is a model-independent gardening platform. It provides a standalone web application, a REST/OpenAPI API, and MCP tools that can be connected to Open WebUI or another MCP client.

## Repository structure

```text
apps/
  server/   TypeScript REST, OpenAPI, and MCP backend
  web/      React/Vite gardening frontend
```

The web application and external AI clients use the same backend service layer and garden data. Open WebUI is an optional client rather than part of the core product.

## Run the core applications

```bash
docker compose up -d --build gardener-api gardener-mcp gardener-web
```

Open the standalone frontend at `http://localhost:5200`.

The REST API is available at `http://localhost:8100`, its OpenAPI document is at `http://localhost:8100/openapi.json`, and the MCP endpoint is at `http://localhost:8101/mcp`.

## Run with Open WebUI

```bash
docker compose --profile open-webui up -d --build
```

Open WebUI runs at `http://localhost:5000`. Register a Streamable HTTP MCP connection using the in-network URL:

```text
http://gardener-mcp:8001/mcp
```

The current MCP service is intended for local development and does not yet authenticate individual users.

## Local development

Node.js 22 or newer is required.

```bash
npm install
npm run dev:server
npm run dev:web
```

Run verification from the repository root:

```bash
npm run typecheck
npm test
npm run build
```

## Current architecture and next step

The first monorepo slice preserves the existing SQLite storage and single API key while separating the frontend and backend into independently deployable applications. The next milestone replaces installation-wide identity with Firebase Authentication and moves user-scoped garden records to Cloud Firestore before public hosting.
