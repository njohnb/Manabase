import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { HttpClient } from "../http/client.ts";
import type { Result } from "../result.ts";
import { cardSearch } from "./card-search.ts";
import type { CardSearchParams } from "./card-search.ts";
import { comboSearch } from "./combo-search.ts";
import type { ComboSearchParams } from "./combo-search.ts";
import { comboFindDeck } from "./combo-find-deck.ts";
import type { ComboFindDeckParams, ComboInclude } from "./combo-find-deck.ts";

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

// (MCP-PRD CAP-02) Four things here are not conveniences — a model that assumes otherwise gets a
// silently wrong answer: names carry no quantities, `unresolved_cards` is the only signal a typo
// cost combos, an offset indexes the CLASSIFIED list rather than an upstream window, and each call
// re-fetches because this server holds no per-user state (D-03).
const COMBO_FIND_DECK_DESCRIPTION =
  "Find which Magic: The Gathering combos a decklist already contains, and — with " +
  '`include: "matched+near"` — the ones it is one card away from, classified by Commander ' +
  "Spellbook. `cards` is main-deck card NAMES only: no quantities and no objects, so strip a " +
  'leading count ("1 Sol Ring" will not resolve). `commanders` is separate and optional. Every ' +
  "submitted name is checked against Scryfall first, and any it does not recognize is listed in " +
  "`unresolved_cards`, which is always present — Commander Spellbook ignores an unknown name " +
  "silently, so this is the only signal that a typo cost you combos. Submit a double-faced card " +
  "by ONE face name: the combined `Front // Back` form is reported unresolved even though the " +
  "card is real. Near-misses are the bulk of " +
  "the data and are absent unless asked for. Pages are filled to a byte budget rather than to a " +
  "combo count, so combos per page varies: pass the previous response's `next_offset` back as " +
  "`offset`, never a computed one. Each call re-fetches and re-classifies the whole deck — there " +
  "is no cursor — and changing `include` or the decklist changes what an offset means, so restart " +
  "at 0. `format` names the single format legality is judged for (default `commander`); these " +
  "format names are not Scryfall's, and an unrecognized one is refused rather than guessed.";

const COMBO_FIND_DECK_INPUT_SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      description: "Main-deck card names. Names only — strip quantities. One entry per distinct card.",
    },
    commanders: {
      type: "array",
      items: { type: "string" },
      description: "Commander names, if any. Names only. At most 12.",
    },
    include: {
      type: "string",
      enum: ["matched", "matched+near"],
      description: "Default: matched (combos the deck contains). matched+near adds the ones it is one card away from.",
    },
    offset: {
      type: "integer",
      minimum: 0,
      description: "0-based start in the classified list. Omit for the first page; then pass the previous response's `next_offset`.",
    },
    format: { type: "string", description: "Format legality is judged for. Default: commander. Unknown values are refused." },
  },
  required: ["cards"],
} as const;

export const CARD_SEARCH_TOOL_NAME = "card_search";
export const COMBO_SEARCH_TOOL_NAME = "combo_search";
export const COMBO_FIND_DECK_TOOL_NAME = "combo_find_deck";

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
  {
    name: COMBO_FIND_DECK_TOOL_NAME,
    description: COMBO_FIND_DECK_DESCRIPTION,
    inputSchema: COMBO_FIND_DECK_INPUT_SCHEMA,
  },
];

const UNIQUE_VALUES = ["cards", "prints", "art"] as const;
const DIR_VALUES = ["auto", "asc", "desc"] as const;
const LEGALITIES_VALUES = ["queried", "default", "all"] as const;
const INCLUDE_VALUES = ["matched", "matched+near"] as const;

function asEnum<T extends string>(allowed: readonly T[], value: unknown): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function errorResult(body: unknown): ToolCallResult {
  return { isError: true, content: [{ type: "text", text: JSON.stringify(body) }] };
}

/**
 * Card names off an arguments object. A non-array is `undefined`; a wrong-typed ENTRY is dropped
 * rather than rejected (MCP-PRD D-07), exactly as `unique` and `legalities` are treated above.
 */
function asNames(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is string => typeof entry === "string");
}

/**
 * All `tools/call` logic, separated from the transport so it is directly testable with no
 * server and no transport (MCP-PRD D-03).
 *
 * Argument validation is minimal (MCP-PRD D-07): the two search tools need an object with a
 * string `q`. The query string itself is never parsed, validated, or rewritten — the source owns
 * its query language, Scryfall for `card_search` and Commander Spellbook for `combo_search`.
 * Optional params pass through when they carry the right primitive type; wrong-typed values and
 * unknown keys are silently dropped.
 *
 * Two tools are routed to the ONE client they may call, so a source a handler has no business
 * reaching is not in scope for it. `combo_find_deck` takes the whole bundle because it genuinely
 * needs two sources: Scryfall to learn which card names are real, Commander Spellbook for the
 * combos. It is the only handler with that warrant.
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
  if (name === COMBO_FIND_DECK_TOOL_NAME) return dispatchComboFindDeck(clients, args);
  throw new Error(`Unknown tool: ${name}`);
}

/** Reads `q` off the arguments object, or returns the one rejection either search tool makes. */
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

/**
 * The one dispatch taking the whole bundle, because `comboFindDeck` legitimately needs two sources.
 *
 * There is deliberately no rejection for a missing or empty `cards` here. `readQuery`'s two-step
 * shape does not fit: the schema's `minItems: 1` is not enforced by the SDK, and an absent, empty
 * or all-blank decklist must produce ONE message describing what a decklist looks like. That
 * message lives in the handler (MCP-PRD CAP-02 criterion 13), so a malformed `cards` arrives there
 * as an empty list and hits it.
 */
async function dispatchComboFindDeck(clients: Clients, args: unknown): Promise<ToolCallResult> {
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    return errorResult({
      error: {
        code: "bad_request",
        message: "Tool arguments must be an object with a `cards` array of card names.",
      },
    });
  }

  const raw = args as Record<string, unknown>;
  const commanders = asNames(raw.commanders);
  const include = asEnum(INCLUDE_VALUES, raw.include);

  // (exactOptionalPropertyTypes) optional keys must be *absent*, not set to `undefined`.
  const params: ComboFindDeckParams = {
    cards: asNames(raw.cards) ?? [],
    ...(commanders !== undefined ? { commanders } : {}),
    ...(include !== undefined ? { include: include as ComboInclude } : {}),
    ...(typeof raw.offset === "number" && Number.isInteger(raw.offset) ? { offset: raw.offset } : {}),
    ...(typeof raw.format === "string" ? { format: raw.format } : {}),
  };

  return toolResult(await comboFindDeck(clients, params));
}

/** Installs the two request handlers; both are thin delegations. */
export function registerTools(server: Server, clients: Clients): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefinitions }));

  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    dispatchToolCall(clients, request.params.name, request.params.arguments),
  );
}
