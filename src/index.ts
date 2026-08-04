import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { APP_VERSION, resolveConfig } from "./config.ts";

// This is the only module allowed to read process.env / process.platform —
// everything below it is a plain, testable function (MCP-PRD D-03, §3.2).
// Resolved-but-unused this slice; Slice 5 consumes it.
const config = resolveConfig(process.env, process.platform);

const server = new Server(
  { name: "manabase-mtg", version: APP_VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));

await server.connect(new StdioServerTransport());
