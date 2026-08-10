import type { Result } from "../result.ts";
import type { ScryfallClient } from "../scryfall/client.ts";
import type { ScryfallCard, ScryfallCardFace, ScryfallList } from "../scryfall/types.ts";
import { resolvePrice } from "../scryfall/prices.ts";
import type { PriceInfo } from "../scryfall/prices.ts";

export type LegalitiesMode = "queried" | "default" | "all";

export interface CardSearchParams {
  q: string;
  unique?: "cards" | "prints" | "art";   // default "cards"
  order?: string;
  dir?: "auto" | "asc" | "desc";
  page?: number;                          // 1-based; default 1
  legalities?: LegalitiesMode;            // default "queried"
}

export interface CardSummary {
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  rarity: string;
  set: string;
  set_name: string;
  legalities: Record<string, string>;
  price: PriceInfo;
}

export interface CardSearchData {
  cards: CardSummary[];
  total_cards: number;
  page: number;
  has_more: boolean;
  /** Which legality scope was requested. Echoes the parameter, including its default. */
  legalities_mode: LegalitiesMode;
  /**
   * The legality keys actually present on the cards below. Formats absent from this list were
   * NOT returned — that is not a claim they are illegal (MCP-PRD §3.6).
   */
  legalities_included: string[];
  /** Present when the model should act: e.g. zero matches, or more pages exist. */
  note?: string;
}

/**
 * Our page size: exactly half Scryfall's 175 (MCP-PRD OQ-02's page cap).
 *
 * Half a page rather than OQ-02's estimated "near 120" because Scryfall's `page` parameter is in
 * units of 175 and the endpoint has no offset: a 120-card cap over a 175-card page would leave
 * cards 121-175 reachable by no `page` value at all — a silent loss worse than the payload problem
 * the cap exists to fix. Halving keeps every card reachable at one upstream request per call.
 */
const PAGE_SIZE = 88;
const UPSTREAM_PAGE_SIZE = 175;

/**
 * Every legality key Scryfall returns on a card object (MCP-PRD §4.1.1, verified 2026-08-07).
 * Scryfall returns 23, not the "roughly 21" OQ-02 was framed against.
 */
const ALL_LEGALITY_KEYS = [
  "standard", "future", "historic", "timeless", "gladiator", "pioneer", "modern", "legacy",
  "pauper", "vintage", "penny", "commander", "oathbreaker", "standardbrawl", "brawl",
  "competitivebrawl", "alchemy", "paupercommander", "duel", "oldschool", "premodern", "predh",
  "tlr",
];

const LEGALITY_KEY_SET = new Set(ALL_LEGALITY_KEYS);

/**
 * The seven paper constructed formats, used when the query names no format (MCP-PRD OQ-02).
 *
 * Hard-coded rather than derived by subtracting unwanted formats: a new format key appearing
 * upstream must land *outside* the default set, not silently inside it.
 */
const DEFAULT_LEGALITY_FORMATS = [
  "standard", "pioneer", "modern", "legacy", "vintage", "commander", "pauper",
];

/**
 * Operators whose value names a format. All five verified live 2026-08-10: `format:` and `legal:`
 * filter exactly as `f:` does, rather than being silently dropped as an unknown term.
 *
 * `\b` lets a leading `-` through — `-f:commander` still means the user cares about commander
 * legality — while refusing a mid-word match like `xformat:`.
 */
const FORMAT_TERM = /\b(?:f|format|legal|banned|restricted)[:=]([A-Za-z0-9_]+)/gi;

/**
 * Read `q` for a hint about which format the user cares about. This is a scan, not a parse: it
 * never rejects a query, never rewrites one, and never changes the bytes sent to Scryfall, which
 * owns the query language (MCP-PRD D-07). A miss costs bytes, never correctness.
 *
 * A value that is not one of the 23 legality keys is a miss, not a match — Scryfall accepts
 * aliases that are not keys (`f:edh` for commander is the known one), and treating one as a key
 * would produce an empty legalities map, which reads as "this card has no legalities".
 */
function scanQueriedFormats(q: string): string[] {
  const found = new Set<string>();
  for (const match of q.matchAll(FORMAT_TERM)) {
    const token = match[1]?.toLowerCase();
    if (token !== undefined && LEGALITY_KEY_SET.has(token)) found.add(token);
  }
  return [...found];
}

interface LegalityScope {
  /** The scope actually applied to the payload — not an echo of the request. */
  mode: LegalitiesMode;
  /** Keys to keep, or `null` for "keep whatever the card carries" (mode `"all"`). */
  keys: readonly string[] | null;
}

/**
 * The scope to apply. Never yields an empty key set: a scan that finds no format — or only
 * aliases that map to no key — degrades to the default set rather than trimming everything away.
 * An empty map would read to the model as "this card has no legalities", a normal-looking
 * response carrying a wrong answer.
 *
 * `mode` degrades with the keys, because it describes the payload rather than the request: a
 * `"queried"` call whose scan missed really did return the default set, and reporting otherwise
 * would put `legalities_mode` and `legalities_included` in disagreement.
 */
function resolveLegalityScope(requested: LegalitiesMode, q: string): LegalityScope {
  if (requested === "all") return { mode: "all", keys: null };
  if (requested === "default") return { mode: "default", keys: DEFAULT_LEGALITY_FORMATS };

  const queried = scanQueriedFormats(q);
  return queried.length > 0
    ? { mode: "queried", keys: queried }
    : { mode: "default", keys: DEFAULT_LEGALITY_FORMATS };
}

// (noUncheckedIndexedAccess) `legalities[key]` is `string | undefined` — same discipline as the
// conditional spreads: never write `undefined` into the map.
function pickLegalities(
  legalities: Record<string, string>,
  keys: readonly string[] | null,
): Record<string, string> {
  if (keys === null) return legalities; // mode "all" — untouched passthrough
  const picked: Record<string, string> = {};
  for (const key of keys) {
    const value = legalities[key];
    if (value !== undefined) picked[key] = value;
  }
  return picked;
}

/**
 * The keys present on *every* card in `cards` — an intersection, so the field can never claim a
 * key some card lacks. Derived from the shaped cards rather than from the requested set, because
 * under `"all"` the response carries whatever Scryfall actually sent. With no cards, it reports
 * the scope that would have applied.
 */
function includedLegalities(cards: CardSummary[], scope: LegalityScope): string[] {
  const first = cards[0];
  if (first === undefined) return scope.keys === null ? [...ALL_LEGALITY_KEYS] : [...scope.keys];
  const candidates = scope.keys ?? Object.keys(first.legalities);
  return candidates.filter((key) => cards.every((card) => key in card.legalities));
}

/**
 * How many of *our* pages a result spans. Not `ceil(total_cards / 88)`: our paging is anchored to
 * upstream pages of 175, so a 176-card result is 3 pages (88 + 87 + 1), where the naive figure
 * says 2 and would tell the model a page does not exist when it does.
 */
function ourPageCount(totalCards: number): number {
  if (totalCards <= 0) return 0;
  const upstreamPages = Math.ceil(totalCards / UPSTREAM_PAGE_SIZE);
  const lastLen = totalCards - (upstreamPages - 1) * UPSTREAM_PAGE_SIZE;
  return (upstreamPages - 1) * 2 + (lastLen > PAGE_SIZE ? 2 : 1);
}

interface PageSlot {
  /** Our page, 1-based. */
  page: number;
  /** The Scryfall page that holds it. Never more than one upstream request per call. */
  upstreamPage: number;
  /** Where our page starts inside that upstream page: 0 or 88. */
  offset: number;
}

/**
 * `page` reaches here from `dispatchToolCall`, which admits any integer, and from direct calls
 * (MCP-PRD D-03) — the schema's `minimum: 1` is not enforced in code, so this defends itself.
 * Unclamped, JS `(-1) % 2 === -1` makes `page: 0` produce `offset: -88` and an empty slice, while
 * `page: -5` produces `offset: -0` and would serve page 1's cards under a nonsense page number —
 * real cards behind a wrong label, the worst failure available here.
 */
function normalizePage(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return 1;
  const truncated = Math.trunc(raw);
  return truncated >= 1 ? truncated : 1;
}

function pageSlot(page: number): PageSlot {
  return {
    page,
    upstreamPage: Math.floor((page - 1) / 2) + 1,
    offset: ((page - 1) % 2) * PAGE_SIZE,
  };
}

/**
 * 1-based index of this page's first card within the whole result. Not `(page - 1) * 88 + 1`:
 * the second half of an upstream page holds 87, so the naive form drifts one card per upstream
 * page and is already wrong on page 3, where it says 177 and the truth is 176.
 */
function firstCardIndex(slot: PageSlot): number {
  return (slot.upstreamPage - 1) * UPSTREAM_PAGE_SIZE + slot.offset + 1;
}

/**
 * A page past the end of a result we already hold. Reported as a failure rather than an empty
 * success so the shape does not depend on the parity of the requested page: page 3 of a 50-card
 * result overshoots the *upstream* page and comes back 422, while page 2 overshoots inside the
 * page we fetched. Both are the same mistake and both must read the same way.
 */
function outOfRangeFailure(slot: PageSlot, totalCards: number): Result<CardSearchData> {
  const pages = ourPageCount(totalCards);
  return {
    ok: false,
    error: {
      // No `status`: this is our determination from a 200 body, not an HTTP outcome.
      code: "bad_request",
      message:
        `Page ${slot.page} is past the end of this result: ${totalCards} cards match, which is ` +
        `${pages} page${pages === 1 ? "" : "s"} of ${PAGE_SIZE} (valid pages 1-${pages}). ` +
        `This is an out-of-range page, not a query that matched nothing.`,
    },
  };
}

/**
 * Scryfall answers a page beyond its last page with HTTP 422 (verified live 2026-08-10), which
 * the client maps to `unexpected` — a code that reads as a server fault and discourages the
 * retry that would actually fix it. Re-code it as the client error it is, keeping Scryfall's
 * verbatim `details` and the real wire status.
 */
function upstreamOutOfRangeFailure(
  slot: PageSlot,
  error: { details?: string },
): Result<CardSearchData> {
  const failed = {
    code: "bad_request" as const,
    message:
      `Page ${slot.page} is past the end of this result — Scryfall has no page ` +
      `${slot.upstreamPage} for this query (our pages are ${PAGE_SIZE} cards, half an upstream ` +
      `page). Request a lower page number.`,
    status: 422,
    // (exactOptionalPropertyTypes) absent, never `undefined`.
    ...(error.details !== undefined ? { details: error.details } : {}),
  };
  return { ok: false, error: failed };
}

/** The total, the range shown, and the page count — in *our* page units. */
function rangeNote(slot: PageSlot, shown: number, totalCards: number): string {
  const from = firstCardIndex(slot);
  const to = from + shown - 1;
  return (
    `${totalCards} cards match; showing cards ${from}-${to} ` +
    `(page ${slot.page} of ${ourPageCount(totalCards)}). ` +
    `Narrow the query or request a specific page.`
  );
}

/** Face-level text fields that get joined when the top-level value is absent. */
type JoinableField = "oracle_text" | "mana_cost";

/**
 * Scryfall puts gameplay text on `card_faces` for double-faced and split cards, leaving the
 * top-level field absent. Join the faces so those cards don't come back blank.
 */
function joinFaces(faces: ScryfallCardFace[], field: JoinableField): string | undefined {
  const parts: string[] = [];
  for (const face of faces) {
    const value = face[field];
    // Skip absent and empty values: a transform card's back face carries `mana_cost: ""`,
    // and joining it would emit a dangling " // " separator with nothing after it.
    if (value !== undefined && value !== "") parts.push(value);
  }
  return parts.length > 0 ? parts.join(" // ") : undefined;
}

function textField(card: ScryfallCard, field: JoinableField): string | undefined {
  const top = card[field];
  if (top !== undefined) return top;
  return card.card_faces !== undefined ? joinFaces(card.card_faces, field) : undefined;
}

// (exactOptionalPropertyTypes) optional keys must be *absent*, not set to `undefined` —
// hence the conditional spreads rather than plain assignment.
function toCardSummary(card: ScryfallCard, keepLegalities: readonly string[] | null): CardSummary {
  const manaCost = textField(card, "mana_cost");
  const oracleText = textField(card, "oracle_text");

  return {
    name: card.name,
    ...(manaCost !== undefined ? { mana_cost: manaCost } : {}),
    cmc: card.cmc,
    type_line: card.type_line,
    ...(oracleText !== undefined ? { oracle_text: oracleText } : {}),
    ...(card.colors !== undefined ? { colors: card.colors } : {}),
    color_identity: card.color_identity,
    ...(card.power !== undefined ? { power: card.power } : {}),
    ...(card.toughness !== undefined ? { toughness: card.toughness } : {}),
    ...(card.loyalty !== undefined ? { loyalty: card.loyalty } : {}),
    rarity: card.rarity,
    set: card.set,
    set_name: card.set_name,
    // (MCP-PRD OQ-02, closed) trimmed to the scope the caller asked for; the keys kept are
    // reported once per response as `legalities_included`. Untrimmed passthrough measured 54.5%
    // of a real response's bytes — see CAP-01 criterion 13.
    legalities: pickLegalities(card.legalities, keepLegalities),
    price: resolvePrice(card),
  };
}

/**
 * Evaluate a Scryfall query and return shaped results.
 *
 * The query is sent verbatim — no parsing, validation, or rewriting (MCP-PRD D-07); Scryfall
 * owns the query language and its error text comes back through `Failure.details`. `q` is *read*
 * to choose which legality keys to keep, which never alters the bytes sent. Pagination is
 * *reported*, never resolved: further pages are never auto-fetched, and the page cap announces
 * itself through `has_more` and `note` rather than truncating silently (MCP-PRD OQ-02).
 * Never throws (MCP-PRD D-10).
 */
export async function cardSearch(
  client: ScryfallClient,
  params: CardSearchParams,
): Promise<Result<CardSearchData>> {
  const unique = params.unique ?? "cards";
  const page = normalizePage(params.page);
  const slot = pageSlot(page);
  const scope = resolveLegalityScope(params.legalities ?? "queried", params.q);

  const result = await client.get("/cards/search", {
    q: params.q,
    unique,
    order: params.order,
    dir: params.dir,
    // Our page is half of Scryfall's, so the upstream page number is not the requested one.
    page: String(slot.upstreamPage),
  });

  if (!result.ok) {
    // Scryfall answers a valid query with zero matches as HTTP 404. No cards matching is a
    // search outcome, not a dead end — report it as a successful, empty search.
    // (Decision made in the Slice 3 spec; flagged for live verification in Slice 6.)
    if (result.error.code === "not_found") {
      const note = result.error.details ?? result.error.message;
      return {
        ok: true,
        value: {
          cards: [],
          total_cards: 0, // the value that distinguishes this from an out-of-range page
          page,
          has_more: false,
          legalities_mode: scope.mode,
          legalities_included: includedLegalities([], scope),
          note,
        },
      };
    }
    // A page beyond Scryfall's last page. Not a malformed query and not a server fault.
    if (result.error.status === 422) return upstreamOutOfRangeFailure(slot, result.error);
    // Everything else passes through unchanged, with Scryfall's details verbatim.
    return result;
  }

  const list = result.value as ScryfallList;
  // An arrow, not `map(toCardSummary)` — `Array.prototype.map` passes the index as the second
  // argument, which would silently arrive as the legality scope.
  const cards = list.data
    .slice(slot.offset, slot.offset + PAGE_SIZE)
    .map((card) => toCardSummary(card, scope.keys));

  // A page past the end *within* an upstream page we already hold — our page 2 of a 50-card
  // result. Scryfall 404s rather than returning a 200 with no matches, so `total_cards > 0` is
  // exactly the signal that this is an out-of-range page and not a query that matched nothing.
  if (cards.length === 0 && list.total_cards > 0) return outOfRangeFailure(slot, list.total_cards);

  const data: CardSearchData = {
    cards,
    total_cards: list.total_cards, // Scryfall's true total; capping a page does not change it
    page,
    // Ours, not upstream's: cards may remain in the page we already fetched. This is the case
    // issue #25 hit — 111 cards with upstream `has_more: false`, 23 of them past our page 1.
    has_more: slot.offset + PAGE_SIZE < list.data.length || list.has_more,
    legalities_mode: scope.mode,
    legalities_included: includedLegalities(cards, scope),
  };

  // Emitted whenever the result spans more than one of our pages — including on the last page,
  // where `has_more` is false but "page 2 of 2" is still the fact the model needs.
  if (data.has_more || ourPageCount(list.total_cards) > 1) {
    data.note = rangeNote(slot, cards.length, list.total_cards);
  }

  return { ok: true, value: data };
}
