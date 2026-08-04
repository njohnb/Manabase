import type { Result } from "../result.ts";
import type { ScryfallClient } from "../scryfall/client.ts";
import type { ScryfallCard, ScryfallCardFace, ScryfallList } from "../scryfall/types.ts";
import { resolvePrice } from "../scryfall/prices.ts";
import type { PriceInfo } from "../scryfall/prices.ts";

export interface CardSearchParams {
  q: string;
  unique?: "cards" | "prints" | "art";   // default "cards"
  order?: string;
  dir?: "auto" | "asc" | "desc";
  page?: number;                          // 1-based; default 1
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
  /** Present when the model should act: e.g. zero matches, or more pages exist. */
  note?: string;
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
function toCardSummary(card: ScryfallCard): CardSummary {
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
    // (MCP-PRD OQ-02) result verbosity is an open question — pass legalities through untrimmed.
    legalities: card.legalities,
    price: resolvePrice(card),
  };
}

/**
 * Evaluate a Scryfall query and return shaped results.
 *
 * The query is sent verbatim — no parsing, validation, or rewriting (MCP-PRD D-07); Scryfall
 * owns the query language and its error text comes back through `Failure.details`. Pagination
 * is *reported*, never resolved: further pages are never auto-fetched and results are never
 * truncated. Never throws (MCP-PRD D-10).
 */
export async function cardSearch(
  client: ScryfallClient,
  params: CardSearchParams,
): Promise<Result<CardSearchData>> {
  const unique = params.unique ?? "cards";
  const page = params.page ?? 1;

  const result = await client.get("/cards/search", {
    q: params.q,
    unique,
    order: params.order,
    dir: params.dir,
    page: String(page),
  });

  if (!result.ok) {
    // Scryfall answers a valid query with zero matches as HTTP 404. No cards matching is a
    // search outcome, not a dead end — report it as a successful, empty search.
    // (Decision made in the Slice 3 spec; flagged for live verification in Slice 6.)
    if (result.error.code === "not_found") {
      const note = result.error.details ?? result.error.message;
      return { ok: true, value: { cards: [], total_cards: 0, page, has_more: false, note } };
    }
    // Everything else passes through unchanged, with Scryfall's details verbatim.
    return result;
  }

  const list = result.value as ScryfallList;
  const cards = list.data.map(toCardSummary);

  const data: CardSearchData = {
    cards,
    total_cards: list.total_cards,
    page,
    has_more: list.has_more,
  };

  if (list.has_more) {
    data.note =
      `${list.total_cards} cards match; showing page ${page}. ` +
      `Narrow the query or request a specific page for more.`;
  }

  return { ok: true, value: data };
}
