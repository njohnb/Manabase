import type { HttpClient } from "../http/client.ts";
import type { Result } from "../result.ts";
import { resolveNames } from "../scryfall/collection.ts";
import type { ScryfallRulingList } from "../scryfall/types.ts";

export interface CardRulingsParams {
  /** Card NAMES. One per card; a double-faced card by ONE face name (MCP-PRD §4.1.2). */
  cards: string[];
}

export interface Ruling {
  /** `"wotc"` (an official Wizards ruling) or `"scryfall"` (a Scryfall note), verbatim. */
  source: string;
  /** `YYYY-MM-DD`, verbatim. */
  published_at: string;
  comment: string;
}

export interface CardRulingsEntry {
  name: string;
  scryfall_uri: string;
  /** `[]` when the card has none — an ordinary outcome, never a failure. */
  rulings: Ruling[];
}

export interface CardRulingsData {
  cards: CardRulingsEntry[];
  /**
   * ALWAYS present, `[]` when none, for the reason `combo_find_deck`'s is: an absent key would let
   * "we checked and every name resolved" and "we did not check" read identically (MCP-PRD §3.6).
   */
  unresolved_cards: string[];
  /** Present only when something about the answer is incomplete. */
  note?: string;
}

/**
 * At most this many names per call (MCP-PRD CAP-03). An interaction question names two or three
 * cards; ten leaves room without letting one call fan out into dozens of rulings requests.
 */
export const MAX_CARDS = 10;

/** Trim, and drop entries that name no card. Not decklist parsing — mirrors `combo-find-deck.ts`. */
function cleanNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const names: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (trimmed.length > 0) names.push(trimmed);
  }
  return names;
}

/** No `status` on either refusal: our determination from the parameters, not an HTTP outcome. */
function emptyFailure(): Result<CardRulingsData> {
  return {
    ok: false,
    error: {
      code: "bad_request",
      message:
        "`cards` must be a non-empty array of card NAMES, such as " +
        '["Rest in Peace", "Blood Artist"]. Nothing was requested.',
    },
  };
}

function tooManyFailure(count: number): Result<CardRulingsData> {
  return {
    ok: false,
    error: {
      code: "bad_request",
      message:
        `\`cards\` carries ${count} names and this tool accepts at most ${MAX_CARDS} per call. ` +
        "Nothing was requested. Ask about the cards actually involved, or split the list across calls.",
    },
  };
}

/** Narrow the parsed body far enough to read it. Never trusts the cast alone. */
function asRulingList(value: unknown): ScryfallRulingList | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  return Array.isArray((value as { data?: unknown }).data) ? (value as ScryfallRulingList) : undefined;
}

function unexpectedBodyFailure(name: string): Result<CardRulingsData> {
  return {
    ok: false,
    error: {
      code: "unexpected",
      message:
        `Scryfall returned a rulings body for "${name}" with no \`data\` array. No rulings were ` +
        "read from it, and the card cannot be reported as having none on the strength of it.",
    },
  };
}

/**
 * Every ruling for a small batch of named cards, in one call (MCP-PRD CAP-03).
 *
 * Scryfall attaches each ruling to ONE card, so there is no interaction ruling to look up: an
 * interaction is answered by reading every card's rulings together, which is why this takes a batch.
 *
 * Names resolve through `POST /cards/collection` first, so a typo comes back in `unresolved_cards`
 * rather than shrinking the answer silently. Then one `GET /cards/{id}/rulings` per resolved card,
 * sequentially. That path is not a card-search endpoint, so the client routes it to Scryfall's
 * 10/sec lane (MCP-PRD §3.4); the cap keeps a call to at most ten of them.
 *
 * Any failure returns the whole call as that failure, never a partial answer: a card missing from
 * `cards` because its request failed would read as a card that was never asked about.
 *
 * Never throws (MCP-PRD D-10).
 */
export async function cardRulings(
  client: HttpClient,
  params: CardRulingsParams,
): Promise<Result<CardRulingsData>> {
  // (MCP-PRD D-10) the handler's own backstop, so it honours "never throws" standing alone and not
  // only in composition with a client that already guards itself.
  try {
    return await fetchRulings(client, params);
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "unexpected",
        message: `Unexpected failure fetching rulings from Scryfall: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
    };
  }
}

async function fetchRulings(
  client: HttpClient,
  params: CardRulingsParams,
): Promise<Result<CardRulingsData>> {
  // Both refusals issue ZERO calls — not even name resolution.
  const names = cleanNames(params.cards);
  if (names.length === 0) return emptyFailure();
  if (names.length > MAX_CARDS) return tooManyFailure(names.length);

  const resolution = await resolveNames(client, names);
  if (!resolution.ok) return resolution;

  const cards: CardRulingsEntry[] = [];
  const seen = new Set<string>();
  const truncated: string[] = [];
  for (const card of resolution.value.cards) {
    // Two spellings of one card resolve to one card object: one request, one entry.
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    const result = await client.get(`/cards/${encodeURIComponent(card.id)}/rulings`);
    if (!result.ok) return result;
    const list = asRulingList(result.value);
    if (list === undefined) return unexpectedBodyFailure(card.name);
    // Never observed live. One request per card is the contract, so a longer list is reported
    // rather than paged.
    if (list.has_more === true) truncated.push(card.name);
    cards.push({
      name: card.name,
      scryfall_uri: card.scryfall_uri,
      rulings: list.data.map(({ source, published_at, comment }) => ({ source, published_at, comment })),
    });
  }

  const data: CardRulingsData = { cards, unresolved_cards: resolution.value.unresolved };
  if (truncated.length > 0) {
    data.note =
      `Scryfall reported more rulings than it returned for: ${truncated.join(", ")}. Those lists ` +
      "may be incomplete; the card's Scryfall page carries the full set.";
  }
  return { ok: true, value: data };
}
