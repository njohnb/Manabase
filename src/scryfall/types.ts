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
