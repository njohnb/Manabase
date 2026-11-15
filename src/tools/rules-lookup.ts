import type { Result } from "../result.ts";
import type { RuleEntry } from "../rules/parser.ts";
import { lookupRule, normalizeRuleNumber, notARuleNumber } from "../rules/lookup.ts";
import { ensureRules } from "../rules/store.ts";
import type { RulesStoreDeps } from "../rules/store.ts";

export interface RulesLookupParams {
  /** A section, rule or subrule number: "7", "702", "702.19", "702.19a". */
  rule: string;
}

export interface RulesLookupData {
  /** The requested rule first, then every rule under it, in document order. */
  rules: RuleEntry[];
  /** True when rules under the requested one were cut at the byte budget. */
  truncated: boolean;
  /** The first omitted rule, when `truncated`. */
  next_rule?: string;
  /** The Comprehensive Rules version this answer comes from, ISO `YYYY-MM-DD`. */
  cr_effective_date: string;
  /** When the cached copy was downloaded from Wizards (ISO timestamp). */
  fetched_at: string;
  /** Whole days since `fetched_at`. */
  cache_age_days: number;
  /** Wizards' official dated PDF of that version, else its TXT. Cite this, with the rule number. */
  citation_url: string;
  /** Present only when the model should act. */
  note?: string;
}

const DAY_MS = 86_400_000;

/**
 * `rules_lookup` by rule number (MCP-PRD CAP-04). Plain function, I/O injected (D-03); never
 * throws (D-10). A malformed number is refused before anything is downloaded.
 */
export async function rulesLookup(
  deps: RulesStoreDeps,
  params: RulesLookupParams,
): Promise<Result<RulesLookupData>> {
  if (normalizeRuleNumber(params.rule) === undefined) return notARuleNumber(params.rule);

  const loaded = await ensureRules(deps);
  if (!loaded.ok) return loaded;
  const { index, citationUrl, fetchedAt } = loaded.value;

  const found = lookupRule(index, params.rule);
  if (!found.ok) return found;

  const { rules, truncated, next_rule } = found.value;
  // (exactOptionalPropertyTypes) optional keys are absent, never `undefined`.
  return {
    ok: true,
    value: {
      rules,
      truncated,
      ...(next_rule !== undefined ? { next_rule } : {}),
      cr_effective_date: index.effectiveDate,
      fetched_at: new Date(fetchedAt).toISOString(),
      cache_age_days: Math.max(0, Math.floor((deps.now() - fetchedAt) / DAY_MS)),
      citation_url: citationUrl,
      ...(next_rule !== undefined
        ? {
            note:
              `Rules under ${rules[0]!.number} were cut at the size budget; ${next_rule} is the ` +
              "first one omitted. Look up a narrower number to read the rest.",
          }
        : {}),
    },
  };
}
