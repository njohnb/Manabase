import type { SpellbookVariant } from "./types.ts";

/**
 * The normalized combo shape. THIS FILE SETS IT and every later consumer reads it — Slice 17's
 * `combo_find_deck`, deck analysis, deck pricing. Nothing downstream ever reads a Commander
 * Spellbook payload directly.
 */

/** The six upstream `/find-my-combos` buckets. `combo_search` never produces one. */
export type ComboBucket =
  | "included" | "includedByChangingCommanders"
  | "almostIncluded" | "almostIncludedByAddingColors"
  | "almostIncludedByChangingCommanders"
  | "almostIncludedByAddingColorsAndChangingCommanders";

export interface ComboCard {
  name: string;
  /** The join back to Scryfall. Never a source for an image URL (MCP-PRD OQ-13). */
  oracle_id: string;
  quantity: number;
  /** Upstream `zoneLocations`, unexpanded: H B G E L C. */
  zones: string[];
  must_be_commander: boolean;
}

export interface ComboTemplate {
  /** e.g. "Permanent Castable for {C}" — a description of a card, not a card. */
  template: string;
  quantity: number;
  zones: string[];
}

export interface ComboSummary {
  id: string;
  /** `combo_find_deck` only; absent on `combo_search`. */
  bucket?: ComboBucket;
  uses: ComboCard[];
  /** Absent when the combo needs no template. */
  requires?: ComboTemplate[];
  /** Feature names — what the combo actually does. */
  produces: string[];
  color_identity: string;
  mana_needed: string;
  mana_value_needed: number;
  /** Absent when upstream reports null. */
  popularity?: number;
  bracket_tag: string;
  /** `easyPrerequisites` and `notablePrerequisites` joined; absent when both are empty. */
  prerequisites?: string;
  /** The step-by-step line. ~40% of the trimmed form and deliberately kept (MCP-PRD §4.4.1). */
  description: string;
  /** For the ONE format named at the top level of the response. */
  legal: boolean;
}

/**
 * Every legality key Commander Spellbook returns on a variant (MCP-PRD §4.4, verified 2026-08-24;
 * re-confirmed against every fixture variant by tests/spellbook/combos.test.ts).
 *
 * SIXTEEN, and they are NOT Scryfall's 23. Two differences bite:
 *   - `standardBrawl` differs from Scryfall's `standardbrawl` only in CASE.
 *   - `historic`, `timeless`, `penny`, `duel`, `future`, `gladiator`, `oldschool` and `tlr` are
 *     Scryfall keys that do not exist here at all.
 * A model that learned CAP-01's key set and passes one of those must be refused, not answered —
 * see `resolveFormat`.
 */
export const SPELLBOOK_LEGALITY_KEYS: readonly string[] = [
  "alchemy", "brawl", "commander", "competitiveBrawl", "legacy", "modern", "oathbreaker",
  "pauper", "pauperCommander", "pauperCommanderMain", "pioneer", "predh", "premodern",
  "standard", "standardBrawl", "vintage",
];

/** Lowercased key -> canonical key, so matching is case-insensitive without losing camelCase. */
const KEY_BY_LOWERCASE = new Map(SPELLBOOK_LEGALITY_KEYS.map((key) => [key.toLowerCase(), key]));

/**
 * The one alias worth carrying: Commander Spellbook has no `edh` key, and Scryfall accepts `f:edh`,
 * so a model that learned the Scryfall spelling would otherwise be refused for asking a question
 * this source can perfectly well answer.
 */
const FORMAT_ALIASES: Readonly<Record<string, string>> = { edh: "commander" };

/**
 * Resolve a requested format to one of the 16 keys, or `undefined` to REFUSE.
 *
 * There is deliberately no fallback to `commander`. Answering a `format: "historic"` call with
 * commander legality answers a different question than the one asked and presents it as the one
 * asked, which MCP-PRD §3.6 forbids — and it is the silent-wrong-answer class this project keeps
 * paying for. A loud refusal is the whole point.
 */
export function resolveFormat(requested: string | undefined): string | undefined {
  if (requested === undefined) return "commander";
  const normalized = requested.trim().toLowerCase();
  return KEY_BY_LOWERCASE.get(FORMAT_ALIASES[normalized] ?? normalized);
}

/**
 * Join the two prerequisite strings. Both are strings rather than arrays and are `""` far more
 * often than not (2 and 16 of the 40 captured on page 1). "\n" is the separator upstream already
 * uses between lines of a single multi-line `notablePrerequisites`, so the joined form reads the
 * same way the unjoined one does.
 */
function joinPrerequisites(variant: SpellbookVariant): string | undefined {
  const parts = [variant.easyPrerequisites, variant.notablePrerequisites].filter((p) => p !== "");
  return parts.length > 0 ? parts.join("\n") : undefined;
}

// (exactOptionalPropertyTypes) optional keys must be *absent*, not set to `undefined` — hence the
// conditional spreads rather than plain assignment.
export function toComboSummary(
  variant: SpellbookVariant,
  formatKey: string,
  bucket?: ComboBucket,
): ComboSummary {
  const prerequisites = joinPrerequisites(variant);

  return {
    id: variant.id,
    ...(bucket !== undefined ? { bucket } : {}),
    uses: variant.uses.map((use) => ({
      name: use.card.name,
      oracle_id: use.card.oracleId,
      quantity: use.quantity,
      zones: use.zoneLocations,
      must_be_commander: use.mustBeCommander,
    })),
    // Templates are components the combo genuinely needs and cannot be folded into `uses`.
    // Cheap to keep: 13.5 characters per variant on average across the 260 captured, with only
    // 39 of 260 carrying one at all (MCP-PRD §4.4.1 / Slice 16 requirement 10).
    ...(variant.requires.length > 0
      ? {
          requires: variant.requires.map((required) => ({
            template: required.template.name,
            quantity: required.quantity,
            zones: required.zoneLocations,
          })),
        }
      : {}),
    produces: variant.produces.map((produced) => produced.feature.name),
    color_identity: variant.identity,
    mana_needed: variant.manaNeeded,
    mana_value_needed: variant.manaValueNeeded,
    ...(variant.popularity !== null ? { popularity: variant.popularity } : {}),
    bracket_tag: variant.bracketTag,
    ...(prerequisites !== undefined ? { prerequisites } : {}),
    description: variant.description,
    // One boolean for one format, never a map of 16 (MCP-PRD §3.6). `=== true` rather than a
    // cast because `noUncheckedIndexedAccess` types this read as `boolean | undefined`; the
    // handler checks the key is actually present before shaping, so a missing key is reported
    // as a failure rather than silently reading as "not legal" here.
    legal: variant.legalities[formatKey] === true,
  };
}

/**
 * A page is filled to a BYTE BUDGET, not to a fixed combo count.
 *
 * Fixed counts do not fit this source. 577 combos sampled across 15 queries on 2026-08-25 measured
 * per-combo cost at 547 minimum, 1,390 median and 4,421 maximum — a 5.7x spread, because cost
 * tracks how many cards a combo uses. Any single count is therefore wrong in both directions at
 * once: a count safe for `cards>5` (a real query, measured at 99,311 characters for 40 combos —
 * 85% of the 116,626 that breached a harness ceiling in issue #25) starves an ordinary
 * `card:"..."` query of two thirds of the combos that would have fit.
 *
 * 50,000 matches CAP-01's delivered band and is under half the known-bad 116,626 — which is a
 * value known to FAIL rather than the limit, the true ceiling being unknown and lower.
 *
 * ONE budget serves the whole capability. `combo_search` and `combo_find_deck` both fill against
 * this constant through the one `fillPage` below; two copies would be two places it can drift.
 */
export const BYTE_BUDGET = 50_000;

/**
 * Reserved for the keys around `combos` — `total_combos`, `offset`, `next_offset`, `has_more`,
 * `format` and the longest `note` either tool emits. Deliberately generous: overshooting the
 * budget matters and under-filling a page by a few hundred bytes does not.
 *
 * It is a CONSTANT part of the envelope only. A caller whose envelope carries something that
 * scales with its input — `combo_find_deck`'s `unresolved_cards`, which is one entry per submitted
 * name that Scryfall did not resolve and reaches thousands of characters on a deck full of typos —
 * passes that size as `extraReserve` rather than hoping 400 covers it.
 */
export const ENVELOPE_RESERVE = 400;

/**
 * Fill a page from already-shaped combos until the byte budget is spent.
 *
 * The `kept.length > 0` guard is load-bearing, not defensive tidiness: a single combo larger than
 * the whole budget must still be returned, or `next_offset` never advances past it and the caller
 * pages forever on an empty result. One oversized combo is a big response; a non-advancing offset
 * is an infinite loop.
 *
 * It takes `ComboSummary[]` rather than a wire envelope because `combo_find_deck`'s input is
 * already classified across six buckets and flattened — there is no single upstream list to hand
 * it. `combo_search` therefore shapes its whole window before filling instead of shaping lazily
 * inside the loop, spending at most `UPSTREAM_LIMIT` `toComboSummary` calls per request on combos
 * it may discard. That cost is bounded and unmeasurable beside a 20 KB gzipped fetch, and it is
 * the price of one budget rather than two.
 */
export function fillPage(summaries: ComboSummary[], extraReserve = 0): ComboSummary[] {
  const kept: ComboSummary[] = [];
  let bytes = ENVELOPE_RESERVE + extraReserve;

  for (const summary of summaries) {
    const cost = JSON.stringify(summary).length + 1; // +1 for the separating comma
    if (kept.length > 0 && bytes + cost > BYTE_BUDGET) break;
    kept.push(summary);
    bytes += cost;
  }

  return kept;
}
