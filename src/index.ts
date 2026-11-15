import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { APP_VERSION, resolveConfig } from "./config.ts";
import { createScryfallClient } from "./scryfall/client.ts";
import { createSpellbookClient } from "./spellbook/client.ts";
import { registerTools } from "./tools/register.ts";
import { createWizardsClients } from "./wizards/client.ts";
import { createNodeRulesFs, createRulesStore } from "./rules/store.ts";

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
// Wizards serves the Comprehensive Rules from two hosts, so it is two clients (MCP-PRD CAP-04).
// Nothing is fetched here: the rules download on the first `rules_lookup` call, never at startup.
const wizards = createWizardsClients(config);

const clients = {
  scryfall: createScryfallClient(config),
  spellbook: createSpellbookClient(config),
  rules: createRulesStore({
    site: wizards.site,
    media: wizards.media,
    siteBaseUrl: config.wizardsSiteBaseUrl,
    mediaBaseUrl: config.wizardsMediaBaseUrl,
    // The pid keeps temp files apart when two servers share one cache directory.
    fs: createNodeRulesFs(String(process.pid)),
    now: Date.now,
    cacheDir: config.cacheDir,
  }),
};

// register.ts owns both tools/list and tools/call.
registerTools(server, clients);

// stdout is the MCP protocol channel — nothing else may write to it.
await server.connect(new StdioServerTransport());
