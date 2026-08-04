import type { ScryfallCard } from "./types.ts";

/**
 * How a card's US-dollar price resolved. The type is final as of Slice 3 — only the
 * implementation of `resolvePrice` changes in Slice 4.
 */
export type PriceInfo =
  | { available: true; usd: string; finish: "nonfoil" | "foil" | "etched" }
  | { available: false; reason: "digital-only" | "no-price-data" };

export function resolvePrice(card: ScryfallCard): PriceInfo {
  // Digital first: a digital printing's null paper prices mean "digital-only", never
  // "no price data" (MCP-PRD §4.1.3 trap 3). MTGO printings carry only `tix`; Arena-only
  // cards carry nothing at all.
  if (card.digital || !card.games.includes("paper")) {
    return { available: false, reason: "digital-only" };
  }
  // First non-null wins, with the finish labeled. `usd` null while `usd_foil` or
  // `usd_etched` is populated is common, not an edge case (trap 2). Prices stay strings.
  const { usd, usd_foil, usd_etched } = card.prices;
  if (usd != null) return { available: true, usd, finish: "nonfoil" };
  if (usd_foil != null) return { available: true, usd: usd_foil, finish: "foil" };
  if (usd_etched != null) return { available: true, usd: usd_etched, finish: "etched" };
  return { available: false, reason: "no-price-data" };
}
