import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { ScryfallClient } from "../scryfall/client.ts";
import { cardSearch } from "./card-search.ts";
import type { CardSearchParams } from "./card-search.ts";

/**
 * The tool result shape this slice emits: text-JSON only, no `structuredContent`.
 * A `type` alias rather than an `interface` so it carries an implicit index signature and
 * satisfies the SDK handler's structural return type.
 */
export type ToolCallResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

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

export const CARD_SEARCH_TOOL_NAME = "card_search";

// (MCP-PRD D-11) `domain_verb_noun`, snake_case, bare. When running inside the plugin the
// harness exposes it as `mcp__plugin_manabase_mtg__card_search` (PLUGIN-PRD P-12) — that
// scoping is the harness's job, not this code's.
export const toolDefinitions: Array<{ name: string; description: string; inputSchema: object }> = [
  {
    name: CARD_SEARCH_TOOL_NAME,
    description: CARD_SEARCH_DESCRIPTION,
    inputSchema: CARD_SEARCH_INPUT_SCHEMA,
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
 * The query string itself is never parsed, validated, or rewritten — Scryfall owns the query
 * language. Optional params pass through when they carry the right primitive type; wrong-typed
 * values and unknown keys are silently dropped.
 *
 * A handler failure is returned as a structured, model-readable result (`isError: true`),
 * never thrown and never a JSON-RPC error (MCP-PRD D-10). The single protocol-level error is
 * an unknown tool name, which is harness misuse rather than a query the model should retry.
 */
export async function dispatchToolCall(
  client: ScryfallClient,
  name: string,
  args: unknown,
): Promise<ToolCallResult> {
  if (name !== CARD_SEARCH_TOOL_NAME) {
    throw new Error(`Unknown tool: ${name}`);
  }

  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    return errorResult({
      error: {
        code: "bad_request",
        message: "Tool arguments must be an object with a string `q` (a Scryfall query).",
      },
    });
  }

  const raw = args as Record<string, unknown>;
  if (typeof raw.q !== "string") {
    return errorResult({
      error: {
        code: "bad_request",
        message: "Missing required argument `q`: a Scryfall query string.",
      },
    });
  }

  const unique = asEnum(UNIQUE_VALUES, raw.unique);
  const dir = asEnum(DIR_VALUES, raw.dir);
  // A wrong-typed or unknown value is dropped rather than rejected, so the handler's `"queried"`
  // default takes over — validation stays minimal and handlers never throw (MCP-PRD D-10).
  const legalities = asEnum(LEGALITIES_VALUES, raw.legalities);

  // (exactOptionalPropertyTypes) optional keys must be *absent*, not set to `undefined`.
  const params: CardSearchParams = {
    q: raw.q,
    ...(unique !== undefined ? { unique } : {}),
    ...(typeof raw.order === "string" ? { order: raw.order } : {}),
    ...(dir !== undefined ? { dir } : {}),
    ...(typeof raw.page === "number" && Number.isInteger(raw.page) ? { page: raw.page } : {}),
    ...(legalities !== undefined ? { legalities } : {}),
  };

  const result = await cardSearch(client, params);

  if (!result.ok) {
    // The full `Failure.error`, including Scryfall's verbatim `details`, so the model can
    // correct a malformed query and retry.
    return errorResult({ error: result.error });
  }

  return { content: [{ type: "text", text: JSON.stringify(result.value) }] };
}

/** Installs the two request handlers; both are thin delegations. */
export function registerTools(server: Server, client: ScryfallClient): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefinitions }));

  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    dispatchToolCall(client, request.params.name, request.params.arguments),
  );
}
