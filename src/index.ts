import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { APP_VERSION, resolveConfig } from "./config.ts";
import { createScryfallClient } from "./scryfall/client.ts";
import { createSpellbookClient } from "./spellbook/client.ts";
import { registerTools } from "./tools/register.ts";

// This is the only module allowed to read process.env / process.platform —
// everything below it is a plain, testable function (MCP-PRD D-03, §3.2).
const config = resolveConfig(process.env, process.platform);

const server = new Server(
  { name: "manabase-mtg", version: APP_VERSION },
  { capabilities: { tools: {} } },
);

// One client per host, each with its own lanes: Scryfall's are sized against Scryfall's published
// numbers and mean nothing to Commander Spellbook, which self-throttles to the strictest lane
// because it publishes no limit (MCP-PRD §3.4, §3.7, OQ-05).
const clients = {
  scryfall: createScryfallClient(config),
  spellbook: createSpellbookClient(config),
};

// register.ts owns both tools/list and tools/call.
registerTools(server, clients);

// stdout is the MCP protocol channel — nothing else may write to it.
await server.connect(new StdioServerTransport());
