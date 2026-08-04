import type { ScryfallCard } from "./types.ts";

/**
 * How a card's US-dollar price resolved. The type is final as of Slice 3 — only the
 * implementation of `resolvePrice` changes in Slice 4.
 */
export type PriceInfo =
  | { available: true; usd: string; finish: "nonfoil" | "foil" | "etched" }
  | { available: false; reason: "digital-only" | "no-price-data" };

export function resolvePrice(card: ScryfallCard): PriceInfo {
  // NAIVE STUB (Track A Slice 3). This is *knowingly wrong* for foil-only, etched-only,
  // and digital-only printings: it reports "no-price-data" for a card that has a
  // `usd_foil` or `usd_etched` price, and never reports "digital-only". Slice 4 replaces
  // this body with the correct finish/digital resolution. The `PriceInfo` type above is
  // final and does not change.
  if (card.prices.usd !== null && card.prices.usd !== undefined) {
    return { available: true, usd: card.prices.usd, finish: "nonfoil" };
  }
  return { available: false, reason: "no-price-data" };
}
