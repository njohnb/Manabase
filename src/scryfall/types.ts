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
