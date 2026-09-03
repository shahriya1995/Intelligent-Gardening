import { randomUUID } from "node:crypto";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "./mcp.js";

const app = express();
app.use(express.json());
const transports = new Map<string, StreamableHTTPServerTransport>();

app.post("/mcp", async (req, res) => {
  const sessionId = req.header("mcp-session-id");
  let transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      onsessioninitialized: (id) => {
        transports.set(id, transport!);
      },
    });
    transport.onclose = () => { if (transport?.sessionId) transports.delete(transport.sessionId); };
    await createMcpServer().connect(transport);
  }
  if (!transport) return res.status(400).json({ error: "Missing or invalid MCP session" });
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req, res) => {
  const transport = transports.get(req.header("mcp-session-id") ?? "");
  if (!transport) return res.status(400).send("Invalid MCP session");
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const transport = transports.get(req.header("mcp-session-id") ?? "");
  if (!transport) return res.status(400).send("Invalid MCP session");
  await transport.handleRequest(req, res);
});

app.listen(8001, "0.0.0.0", () => console.log("Open Gardener MCP listening on http://0.0.0.0:8001/mcp"));
