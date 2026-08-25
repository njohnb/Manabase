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
