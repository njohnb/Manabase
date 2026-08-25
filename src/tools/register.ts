import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { HttpClient } from "../http/client.ts";
import type { Result } from "../result.ts";
import { cardSearch } from "./card-search.ts";
import type { CardSearchParams } from "./card-search.ts";
import { comboSearch } from "./combo-search.ts";
import type { ComboSearchParams } from "./combo-search.ts";

/**
 * The tool result shape this slice emits: text-JSON only, no `structuredContent`.
 * A `type` alias rather than an `interface` so it carries an implicit index signature and
 * satisfies the SDK handler's structural return type.
 */
export type ToolCallResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/**
 * The sources this server can reach, bundled rather than threaded through every call site as
 * positional arguments.
 *
 * Each handler still receives the ONE client it needs — `cardSearch(clients.scryfall, …)`,
 * `comboSearch(clients.spellbook, …)` — so no handler can reach a source it has no business
 * calling, and MCP-PRD D-03's plain-function testability is untouched. Slice 17's
 * `combo_find_deck` needs two clients in one handler and takes the bundle.
 */
export interface Clients {
  scryfall: HttpClient;
  spellbook: HttpClient;
}

// (MCP-PRD OQ-01) Deep Scryfall-syntax teaching ships in the plugin's skill, not here —
// whether this description needs to grow is measured later, not guessed at now.
const CARD_SEARCH_DESCRIPTION =
  "Search Magic: The Gathering cards using Scryfall query syntax, evaluated by Scryfall " +
  "itself — supports all operators including `t:`, `o:`, `f:`, `cmc`, `usd`, `otag:`, " +
  "`art:`, and regex (`o:/…/`). Returns per-card gameplay fields, format legalities, and a " +
  "USD price with finish. 88 cards per page; the response reports `total_cards` and " +
  "`has_more`. Legalities are trimmed to the format the query names (`legalities` to widen); " +
  "formats absent from `legalities_included` were not returned and are not claims about " +
  "legality.";

// Hand-written JSON Schema: the low-level SDK server takes plain JSON Schema in `tools/list`,
// so no schema library (and no new dependency) is needed.
const CARD_SEARCH_INPUT_SCHEMA = {
  type: "object",
  properties: {
    q: { type: "string", description: "Scryfall query string. Full Scryfall syntax; evaluated server-side." },
    unique: { type: "string", enum: ["cards", "prints", "art"], description: "Result rollup. Default: cards (one row per card)." },
    order: { type: "string", description: "Sort field, e.g. name, cmc, usd, edhrec, released." },
    dir: { type: "string", enum: ["auto", "asc", "desc"], description: "Sort direction." },
    page: { type: "integer", minimum: 1, description: "1-based page; 88 cards per page." },
    legalities: { type: "string", enum: ["queried", "default", "all"], description: "Legality scope. Default: queried (the format `q` names, else seven paper formats)." },
  },
  required: ["q"],
} as const;

// (MCP-PRD CAP-02, OQ-14) The Commander Spellbook query language is not taught here. It names
// the source, the page size, and `format`'s refusal behaviour, because a model that guesses a
// Scryfall format name would otherwise pay a round trip to find out.
const COMBO_SEARCH_DESCRIPTION =
  "Find Magic: The Gathering combos using Commander Spellbook query syntax, evaluated by " +
  "Commander Spellbook itself — `card:\"Thassa's Oracle\"` is the common case. Returns each " +
  "combo's cards, what it produces, mana needed, prerequisites, and a step-by-step description. " +
  "Pages are sized by bytes, not by a fixed count, so combos per page varies; the response " +
  "reports `total_combos`, `has_more` and `next_offset` — pass `next_offset` back as `offset` " +
  "for the next page, never a computed one. `format` names the single format legality is judged " +
  "for (default `commander`); these format names are not Scryfall's, and an unrecognized one is " +
  "refused rather than guessed. An invalid query returns Commander Spellbook's error text " +
  "verbatim — correct it and retry.";

// `format` is a string rather than a 16-value enum on purpose: sixteen values is a large schema
// for a parameter almost nobody sets, and the handler's refusal already names the valid set at
// the moment it matters.
const COMBO_SEARCH_INPUT_SCHEMA = {
  type: "object",
  properties: {
    q: { type: "string", description: "Commander Spellbook query string. Evaluated server-side; sent unmodified." },
    offset: { type: "integer", minimum: 0, description: "0-based start, in combos. Omit for the first page; then pass the previous response's `next_offset`." },
    format: { type: "string", description: "Format legality is judged for. Default: commander. Unknown values are refused." },
  },
  required: ["q"],
} as const;

export const CARD_SEARCH_TOOL_NAME = "card_search";
export const COMBO_SEARCH_TOOL_NAME = "combo_search";

// (MCP-PRD D-11) `domain_verb_noun`, snake_case, bare. When running inside the plugin the
// harness exposes it as `mcp__plugin_manabase_mtg__card_search` (PLUGIN-PRD P-12) — that
// scoping is the harness's job, not this code's.
export const toolDefinitions: Array<{ name: string; description: string; inputSchema: object }> = [
  {
    name: CARD_SEARCH_TOOL_NAME,
    description: CARD_SEARCH_DESCRIPTION,
    inputSchema: CARD_SEARCH_INPUT_SCHEMA,
  },
  {
    name: COMBO_SEARCH_TOOL_NAME,
    description: COMBO_SEARCH_DESCRIPTION,
    inputSchema: COMBO_SEARCH_INPUT_SCHEMA,
  },
];

const UNIQUE_VALUES = ["cards", "prints", "art"] as const;
const DIR_VALUES = ["auto", "asc", "desc"] as const;
const LEGALITIES_VALUES = ["queried", "default", "all"] as const;

function asEnum<T extends string>(allowed: readonly T[], value: unknown): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function errorResult(body: unknown): ToolCallResult {
  return { isError: true, content: [{ type: "text", text: JSON.stringify(body) }] };
}

/**
 * All `tools/call` logic, separated from the transport so it is directly testable with no
 * server and no transport (MCP-PRD D-03).
 *
 * Argument validation is minimal (MCP-PRD D-07): `args` must be an object with a string `q`.
 * The query string itself is never parsed, validated, or rewritten — the source owns its query
 * language, Scryfall for `card_search` and Commander Spellbook for `combo_search`. Optional
 * params pass through when they carry the right primitive type; wrong-typed values and unknown
 * keys are silently dropped.
 *
 * Each tool is routed to the ONE client it may call, so a source a handler has no business
 * reaching is not in scope for it.
 *
 * A handler failure is returned as a structured, model-readable result (`isError: true`),
 * never thrown and never a JSON-RPC error (MCP-PRD D-10). The single protocol-level error is
 * an unknown tool name, which is harness misuse rather than a query the model should retry.
 */
export async function dispatchToolCall(
  clients: Clients,
  name: string,
  args: unknown,
): Promise<ToolCallResult> {
  if (name === CARD_SEARCH_TOOL_NAME) return dispatchCardSearch(clients.scryfall, args);
  if (name === COMBO_SEARCH_TOOL_NAME) return dispatchComboSearch(clients.spellbook, args);
  throw new Error(`Unknown tool: ${name}`);
}

/** Reads `q` off the arguments object, or returns the one rejection either tool makes. */
function readQuery(args: unknown, language: string): string | ToolCallResult {
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    return errorResult({
      error: {
        code: "bad_request",
        message: `Tool arguments must be an object with a string \`q\` (a ${language} query).`,
      },
    });
  }
  const raw = args as Record<string, unknown>;
  if (typeof raw.q !== "string") {
    return errorResult({
      error: {
        code: "bad_request",
        message: `Missing required argument \`q\`: a ${language} query string.`,
      },
    });
  }
  return raw.q;
}

/**
 * A handler `Result` as a tool result. A failure carries the full `Failure.error`, including the
 * source's verbatim `details`, so the model can correct a malformed query and retry.
 */
function toolResult(result: Result<unknown>): ToolCallResult {
  if (!result.ok) return errorResult({ error: result.error });
  return { content: [{ type: "text", text: JSON.stringify(result.value) }] };
}

async function dispatchCardSearch(client: HttpClient, args: unknown): Promise<ToolCallResult> {
  const q = readQuery(args, "Scryfall");
  if (typeof q !== "string") return q;

  const raw = args as Record<string, unknown>;
  const unique = asEnum(UNIQUE_VALUES, raw.unique);
  const dir = asEnum(DIR_VALUES, raw.dir);
  // A wrong-typed or unknown value is dropped rather than rejected, so the handler's `"queried"`
  // default takes over — validation stays minimal and handlers never throw (MCP-PRD D-10).
  const legalities = asEnum(LEGALITIES_VALUES, raw.legalities);

  // (exactOptionalPropertyTypes) optional keys must be *absent*, not set to `undefined`.
  const params: CardSearchParams = {
    q,
    ...(unique !== undefined ? { unique } : {}),
    ...(typeof raw.order === "string" ? { order: raw.order } : {}),
    ...(dir !== undefined ? { dir } : {}),
    ...(typeof raw.page === "number" && Number.isInteger(raw.page) ? { page: raw.page } : {}),
    ...(legalities !== undefined ? { legalities } : {}),
  };

  return toolResult(await cardSearch(client, params));
}

async function dispatchComboSearch(client: HttpClient, args: unknown): Promise<ToolCallResult> {
  const q = readQuery(args, "Commander Spellbook");
  if (typeof q !== "string") return q;

  const raw = args as Record<string, unknown>;

  // (MCP-PRD D-07) A wrong-typed `offset` or `format` is silently dropped and the handler's
  // default applies, exactly as `unique` and `legalities` are treated above. A missing or
  // non-string `q` stays the one rejection. An unknown *format string* is a different matter and
  // is refused by the handler, which is where the valid set is named.
  const params: ComboSearchParams = {
    q,
    ...(typeof raw.offset === "number" && Number.isInteger(raw.offset) ? { offset: raw.offset } : {}),
    ...(typeof raw.format === "string" ? { format: raw.format } : {}),
  };

  return toolResult(await comboSearch(client, params));
}

/** Installs the two request handlers; both are thin delegations. */
export function registerTools(server: Server, clients: Clients): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefinitions }));

  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    dispatchToolCall(clients, request.params.name, request.params.arguments),
  );
}
