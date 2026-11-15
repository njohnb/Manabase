/**
 * The one response budget, in characters of JSON, that every bounded tool fills to.
 *
 * Issue #25 measured what an unbounded payload costs: a 116,626-character `card_search` result was
 * lost whole past the harness tool-result ceiling. 50,000 matches CAP-01's delivered band and is
 * under half that known-bad figure — which is a value known to FAIL rather than the limit, the true
 * ceiling being unknown and lower.
 *
 * Shared by the combo tools (`src/spellbook/combos.ts`) and `rules_lookup` (`src/rules/lookup.ts`).
 * One constant, so the figure cannot drift between them. Each consumer keeps its own envelope
 * reserve, because what surrounds the filled items differs per tool.
 */
export const BYTE_BUDGET = 50_000;
