// Minimal Scryfall wire shapes — only the fields this codebase reads. Scryfall card objects
// carry ~70 fields; modelling all of them would be churn with no consumer.

export interface ScryfallPrices {
  usd: string | null;
  usd_foil: string | null;
  usd_etched: string | null;
  eur: string | null;
  eur_foil: string | null;
  tix: string | null;
  // NOTE: eur_etched does not exist in the live API even though Scryfall's docs list it. Do not add it.
}

export interface ScryfallCardFace {
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
}

export interface ScryfallCard {
  /**
   * Optional in the TYPE only: every real card object carries both (verified 2026-11-15, MCP-PRD
   * §4.1.5), but `card_search` reads neither and its fixtures predate them, so readers guard.
   */
  id?: string;
  /** The card's Scryfall web page, `?utm_source=api` included as served. */
  scryfall_uri?: string;
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
  digital: boolean;
  games: string[];
  legalities: Record<string, string>;
  prices: ScryfallPrices;
  card_faces?: ScryfallCardFace[];
}

export interface ScryfallList {
  object: "list";
  total_cards: number;
  has_more: boolean;
  data: ScryfallCard[];
}

/**
 * One ruling from `GET /cards/{id}/rulings` (MCP-PRD §4.1.5, verified 2026-11-15). The live object
 * also carries `object: "ruling"` and `oracle_id`; neither is read, so neither is modelled.
 */
export interface ScryfallRuling {
  /** `"wotc"` observed live; `"scryfall"` is documented and was not seen in the probe. */
  source: string;
  published_at: string;
  comment: string;
}

/**
 * The rulings envelope: `{ object: "list", has_more, data }` — no `total_cards`, unlike
 * `ScryfallList`. `has_more` was `false` on the one card probed.
 */
export interface ScryfallRulingList {
  object: "list";
  has_more: boolean;
  data: ScryfallRuling[];
}

/**
 * The `POST /cards/collection` envelope (MCP-PRD §4.1.2).
 *
 * NOT `ScryfallList`, and reusing that type here would not compile: this envelope carries neither
 * `total_cards` nor `has_more`, and it carries `not_found`, which the search envelope has no
 * equivalent of.
 *
 * `not_found` is the whole reason CAP-02 touches Scryfall at all. Commander Spellbook ignores an
 * unrecognized card name silently — HTTP 200, no warning, no echo of the input (MCP-PRD §4.4) —
 * so this is the only mechanism by which a caller ever learns a submitted name matched nothing.
 */
export interface ScryfallCollection {
  object: "list";
  /**
   * The identifier OBJECTS submitted, echoed back — `[{"name":"Zzzz Not A Real Card 9999"}]`, never
   * a bare string (verified 2026-08-24, MCP-PRD §4.4). `name` is optional because this codebase
   * cannot prove Scryfall echoes it for identifier kinds it does not submit.
   */
  not_found: Array<{ name?: string }>;
  data: ScryfallCard[];
}
