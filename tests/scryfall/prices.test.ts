import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ScryfallCard } from "../../src/scryfall/types.ts";
import { resolvePrice } from "../../src/scryfall/prices.ts";

// Loaded at runtime rather than imported: no `resolveJsonModule` / import attributes needed,
// and it behaves the same under type stripping and under the esbuild bundle.
function fixture(name: string): ScryfallCard {
  return JSON.parse(
    readFileSync(new URL(`../fixtures/prices/${name}.json`, import.meta.url), "utf8"),
  ) as ScryfallCard;
}

const gaeasCradle = fixture("gaeas-cradle-jgp");
const etchedOnly = fixture("etched-only");
const blackLotusMtgo = fixture("black-lotus-mtgo");
const arenaOnly = fixture("arena-only");
const ordinaryNonfoil = fixture("ordinary-nonfoil");
const paperNoPrice = fixture("paper-no-price");

describe("resolvePrice — finish resolution", () => {
  test("[CAP-01 #4] a foil-only printing resolves to the foil price, not 'no price'", () => {
    // Gaea's Cradle (jgp): usd null, usd_foil "3999.00" — the trap that reports a $4,000
    // card as unpriced (MCP-PRD §4.1.3 trap 2).
    assert.equal(gaeasCradle.prices.usd, null);

    assert.deepEqual(resolvePrice(gaeasCradle), {
      available: true,
      usd: "3999.00",
      finish: "foil",
    });
  });

  test("[CAP-01 #5] an etched-only printing resolves to the etched price", () => {
    assert.equal(etchedOnly.prices.usd, null);
    assert.equal(etchedOnly.prices.usd_foil, null);

    assert.deepEqual(resolvePrice(etchedOnly), {
      available: true,
      usd: "5.42",
      finish: "etched",
    });
  });

  test("resolution order is usd -> usd_foil -> usd_etched; the first hit wins", () => {
    // Both usd and usd_foil are populated, so this proves precedence rather than absence.
    assert.equal(ordinaryNonfoil.prices.usd, "2.99");
    assert.equal(ordinaryNonfoil.prices.usd_foil, "14.50");

    assert.deepEqual(resolvePrice(ordinaryNonfoil), {
      available: true,
      usd: "2.99",
      finish: "nonfoil",
    });
  });

  test("prices pass through as strings, never parsed or rounded", () => {
    const price = resolvePrice(gaeasCradle);
    assert.ok(price.available);
    assert.equal(typeof price.usd, "string");
    assert.equal(price.usd, "3999.00"); // trailing zeros preserved verbatim
  });
});

describe("resolvePrice — unavailable reasons", () => {
  test("[CAP-01 #6] an MTGO printing is digital-only, not missing data", () => {
    // Scryfall's exact-name lookup for Black Lotus returns this MTGO printing: every paper
    // price is null and only `tix` is populated.
    assert.equal(blackLotusMtgo.prices.tix, "45.98");

    assert.deepEqual(resolvePrice(blackLotusMtgo), {
      available: false,
      reason: "digital-only",
    });
  });

  test("[CAP-01 #7] an Arena-only printing states the digital-only reason", () => {
    assert.deepEqual(resolvePrice(arenaOnly), {
      available: false,
      reason: "digital-only",
    });
  });

  test("a non-paper printing is digital-only even when the digital flag is false", () => {
    // The `games` check stands on its own: clearing `digital` must not make an Arena-only
    // printing look like a paper card with missing prices.
    const notFlagged: ScryfallCard = { ...arenaOnly, digital: false };

    assert.deepEqual(resolvePrice(notFlagged), {
      available: false,
      reason: "digital-only",
    });
  });

  test("a paper printing with no prices is no-price-data, never digital-only", () => {
    assert.deepEqual(resolvePrice(paperNoPrice), {
      available: false,
      reason: "no-price-data",
    });
    // The two unavailable reasons must never blur into each other.
    assert.notDeepEqual(resolvePrice(paperNoPrice), resolvePrice(blackLotusMtgo));
  });
});
