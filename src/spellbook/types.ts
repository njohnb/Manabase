// Minimal Commander Spellbook wire shapes — only the fields this codebase reads, the same
// discipline src/scryfall/types.ts follows.
//
// TWO OF THE OMISSIONS ARE THE MECHANISM, NOT TIDINESS. Do not add them "for completeness".
//
//   1. `Variant.prices` carries `tcgplayer`, `cardkingdom` and `cardmarket`. MCP-PRD D-06 makes
//      Scryfall the price source, and CAP-02 criterion 6 says no response carries a Commander
//      Spellbook price field.
//   2. `uses[].card` carries TEN `imageUri*` fields worth 41.9% of the upstream payload
//      (MCP-PRD §4.4.1). CAP-02 criterion 7 says no response carries one, and OQ-13 separately
//      settled that an image URL must never be assembled from an id or `oracleId` either.
//
// Declaring neither field makes both criteria unviolatable AT COMPILE TIME rather than merely
// tested: code cannot read a field the type does not declare, and `npm run typecheck` is the gate.
// That is the same reasoning that keeps `eur_etched` out of the Scryfall price model
// (MCP-PRD §4.1.3), and it is one of the four grounds D-16 rejected the first-party generated
// types on — even as a type-only devDependency, which would have cost zero bundle bytes.
//
// Also undeclared because nothing reads them: `faces`, `usedFace`, `spoiler`, `typeLine`,
// `template.scryfallQuery`, `template.scryfallApi`, `status`, `notes`, `of`, `includes`,
// `variantCount`, and the four `*CardState` strings.

export interface SpellbookCard {
  name: string;
  /** The join back to Scryfall. Never used to build an image URL (MCP-PRD OQ-13). */
  oracleId: string;
}

export interface SpellbookUse {
  card: SpellbookCard;
  quantity: number;
  /** Single-letter zone codes: H B G E L C. Passed through unexpanded. */
  zoneLocations: string[];
  mustBeCommander: boolean;
}

/**
 * A template is a *description* of a card the combo needs — "Permanent Castable for {C}" — not a
 * card. It cannot be folded into `uses`, and dropping it loses a component the combo genuinely
 * needs (Slice 16 requirement 10).
 */
export interface SpellbookRequire {
  template: { name: string };
  quantity: number;
  zoneLocations: string[];
}

export interface SpellbookProduce {
  feature: { name: string };
  quantity: number;
}

export interface SpellbookVariant {
  id: string;
  uses: SpellbookUse[];
  requires: SpellbookRequire[];
  produces: SpellbookProduce[];
  /** Colour identity as a letter string, e.g. "UB" — not Scryfall's array. */
  identity: string;
  manaNeeded: string;
  manaValueNeeded: number;
  /** Null on variants upstream has no popularity figure for. */
  popularity: number | null;
  bracketTag: string;
  description: string;
  /**
   * STRINGS, not arrays, and `""` far more often than not. Multi-line values already separate
   * their lines with "\n" upstream, which is why the two are joined with the same character.
   */
  easyPrerequisites: string;
  notablePrerequisites: string;
  /**
   * 16 keys, and they are NOT Scryfall's 23 (MCP-PRD §4.4). The values are BOOLEANS, not
   * Scryfall's "legal" / "not_legal" strings — do not reuse `CardSummary.legalities`'s shape.
   */
  legalities: Record<string, boolean>;
}

/** The `GET /variants/` envelope. Django REST framework's standard pagination shape. */
export interface SpellbookVariantList {
  /**
   * `null` unless the request sent `count=true`, and the key is always present — so a missing
   * total does not announce itself as missing, it reads as a total of nothing
   * (verified 2026-08-24, MCP-PRD §4.4).
   */
  count: number | null;
  next: string | null;
  previous: string | null;
  results: SpellbookVariant[];
}

/**
 * `POST /find-my-combos`'s `results` — an OBJECT of six buckets plus `identity`, not an array
 * (verified 2026-08-24, MCP-PRD §4.4). That is the one structural difference from `/variants/`.
 *
 * `identity` sits HERE, inside `results`, and not at the envelope top level. Reading it from the
 * envelope produces `undefined` rather than an error, which is why it is declared where it lives.
 *
 * Only the first two buckets name combos the deck actually contains. `includedByChangingCommanders`
 * and `almostIncludedByChangingCommanders` differ by one word and mean opposite things, so the
 * names are carried through verbatim rather than translated: a translation layer here surfaces a
 * correctly-shaped, WRONGLY-LABELLED result, which is the failure mode MCP-PRD §4.4 rejects local
 * deck matching for.
 */
export interface SpellbookDeckResults {
  /** The deck's colour identity as a letter string, e.g. "UBR". */
  identity: string;
  included: SpellbookVariant[];
  includedByChangingCommanders: SpellbookVariant[];
  almostIncluded: SpellbookVariant[];
  almostIncludedByAddingColors: SpellbookVariant[];
  almostIncludedByChangingCommanders: SpellbookVariant[];
  almostIncludedByAddingColorsAndChangingCommanders: SpellbookVariant[];
}

/** The `POST /find-my-combos` envelope. The same DRF pagination keys wrap a different `results`. */
export interface SpellbookFindMyCombos {
  count: number | null;
  /**
   * Expected `null`: this capability sends no `limit` and no `offset` (MCP-PRD CAP-02 criterion
   * 10), and the 164-variant capture came back whole. A non-null value would mean upstream
   * paginated anyway, and the handler reports that rather than under-counting silently.
   */
  next: string | null;
  previous: string | null;
  results: SpellbookDeckResults;
}
