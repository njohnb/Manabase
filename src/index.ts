import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { APP_VERSION, resolveConfig } from "./config.ts";
import { createScryfallClient } from "./scryfall/client.ts";
import { registerTools } from "./tools/register.ts";

// This is the only module allowed to read process.env / process.platform —
// everything below it is a plain, testable function (MCP-PRD D-03, §3.2).
const config = resolveConfig(process.env, process.platform);

const server = new Server(
  { name: "manabase-mtg-SLICE11-DEMO", version: APP_VERSION },
  { capabilities: { tools: {} } },
);

const client = createScryfallClient(config);

// register.ts owns both tools/list and tools/call.
registerTools(server, client);

// stdout is the MCP protocol channel — nothing else may write to it.
await server.connect(new StdioServerTransport());
