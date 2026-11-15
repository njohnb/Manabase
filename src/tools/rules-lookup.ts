import type { Result } from "../result.ts";
import type { GlossaryEntry, RuleEntry } from "../rules/parser.ts";
import { lookupRule, normalizeRuleNumber, notARuleNumber, searchRules } from "../rules/lookup.ts";
import { ensureRules } from "../rules/store.ts";
import type { CachedRules, RulesStoreDeps } from "../rules/store.ts";

/** Exactly one of the two. Both, or neither, is a `bad_request`. */
export interface RulesLookupParams {
  /** A section, rule or subrule number: "7", "702", "702.19", "702.19a". */
  rule?: string;
  /** A rules term or phrase: "trample", "mana value". Glossary first, then rule text. */
  query?: string;
}

export interface RulesLookupData {
  /** Query mode only: the query as received. */
  query?: string;
  /** Query mode only: matching glossary entries, the exact term first. Always ahead of `rules`. */
  glossary?: GlossaryEntry[];
  /**
   * Rule mode: the requested rule first, then every rule under it, in document order.
   * Query mode: the rules whose text matches, each with its number.
   */
  rules: RuleEntry[];
  /** Query mode only: every glossary match, shown or not. */
  total_glossary_matches?: number;
  /** Query mode only: every rule match, shown or not. */
  total_rule_matches?: number;
  /** True when the result was cut at the byte budget. */
  truncated: boolean;
  /** Rule mode only: the first omitted rule, when `truncated`. */
  next_rule?: string;
  /** The Comprehensive Rules version this answer comes from, ISO `YYYY-MM-DD`. */
  cr_effective_date: string;
  /** When the cached copy was downloaded from Wizards (ISO timestamp). */
  fetched_at: string;
  /** Whole days since `fetched_at`. */
  cache_age_days: number;
  /** When Wizards' landing page last confirmed this version current (ISO timestamp). */
  checked_at: string;
  /**
   * True when the weekly check against Wizards failed and the cached copy was served as it
   * stands. Still an answer — `note` says how old and why.
   */
  stale: boolean;
  /** Wizards' official dated PDF of that version, else its TXT. Cite this, with the rule number. */
  citation_url: string;
  /** Present only when the model should act. */
  note?: string;
}

const DAY_MS = 86_400_000;

function badRequest(message: string): { ok: false; error: { code: "bad_request"; message: string } } {
  return { ok: false, error: { code: "bad_request", message } };
}

function cacheAgeDays(deps: RulesStoreDeps, loaded: CachedRules): number {
  return Math.max(0, Math.floor((deps.now() - loaded.fetchedAt) / DAY_MS));
}

/**
 * The fields every success carries, whichever mode: the version, the cache's age, when it was last
 * confirmed current, whether that check failed, and the citation.
 */
function provenance(deps: RulesStoreDeps, loaded: CachedRules) {
  return {
    cr_effective_date: loaded.index.effectiveDate,
    fetched_at: new Date(loaded.fetchedAt).toISOString(),
    cache_age_days: cacheAgeDays(deps, loaded),
    checked_at: new Date(loaded.checkedAt).toISOString(),
    stale: loaded.stale,
    citation_url: loaded.citationUrl,
  };
}

/** A stale copy is always said so, ahead of any mode-specific note. */
function withStaleNote(deps: RulesStoreDeps, loaded: CachedRules, modeNote: string | undefined): string | undefined {
  if (!loaded.stale) return modeNote;
  const stale =
    `These rules are from the cached ${loaded.index.effectiveDate} version, downloaded ` +
    `${cacheAgeDays(deps, loaded)} days ago; the weekly check for a newer version failed ` +
    `(${loaded.staleReason ?? "no reason given"}). Tell the user which version you are citing ` +
    "and that a newer one may exist.";
  return modeNote !== undefined ? `${stale} ${modeNote}` : stale;
}

/**
 * `rules_lookup` (MCP-PRD CAP-04): by rule number, or by keyword over the glossary and then the
 * rule text. Plain function, I/O injected (D-03); never throws (D-10). Malformed input is refused
 * before anything is downloaded.
 */
export async function rulesLookup(
  deps: RulesStoreDeps,
  params: RulesLookupParams,
): Promise<Result<RulesLookupData>> {
  const { rule, query } = params;
  if ((rule === undefined) === (query === undefined)) {
    return badRequest(
      "Pass exactly one of `rule` (a Comprehensive Rules number such as \"702.19\") or `query` " +
        "(a rules term such as \"trample\"), not " + (rule === undefined ? "neither." : "both."),
    );
  }
  if (rule !== undefined && normalizeRuleNumber(rule) === undefined) return notARuleNumber(rule);
  if (query !== undefined && query.trim() === "") {
    return badRequest('The query is empty. Pass a rules term such as "trample" or "mana value".');
  }

  const loaded = await ensureRules(deps);
  if (!loaded.ok) return loaded;

  return rule !== undefined
    ? byNumber(deps, loaded.value, rule)
    : byKeyword(deps, loaded.value, query!);
}

function byNumber(deps: RulesStoreDeps, loaded: CachedRules, rule: string): Result<RulesLookupData> {
  const found = lookupRule(loaded.index, rule);
  if (!found.ok) return found;

  const { rules, truncated, next_rule } = found.value;
  const note = withStaleNote(
    deps,
    loaded,
    next_rule !== undefined
      ? `Rules under ${rules[0]!.number} were cut at the size budget; ${next_rule} is the ` +
          "first one omitted. Look up a narrower number to read the rest."
      : undefined,
  );
  // (exactOptionalPropertyTypes) optional keys are absent, never `undefined`.
  return {
    ok: true,
    value: {
      rules,
      truncated,
      ...(next_rule !== undefined ? { next_rule } : {}),
      ...provenance(deps, loaded),
      ...(note !== undefined ? { note } : {}),
    },
  };
}

function byKeyword(deps: RulesStoreDeps, loaded: CachedRules, query: string): Result<RulesLookupData> {
  const found = searchRules(loaded.index, query);
  if (!found.ok) return found;

  const { glossary, rules, total_glossary_matches, total_rule_matches, truncated } = found.value;
  const modeNote =
    total_glossary_matches + total_rule_matches === 0
      ? `No glossary term or rule text contains "${query}". Try the term's singular form, a ` +
        "shorter phrase, or a related term; if you know the rule number, pass `rule` instead."
      : truncated
        ? `Matches were cut at the size budget: ${glossary.length} of ${total_glossary_matches} ` +
          `glossary entries and ${rules.length} of ${total_rule_matches} matching rules are shown. ` +
          "Narrow the query, or look up a rule number from these results with `rule`."
        : undefined;
  const note = withStaleNote(deps, loaded, modeNote);

  return {
    ok: true,
    value: {
      query,
      glossary,
      rules,
      total_glossary_matches,
      total_rule_matches,
      truncated,
      ...provenance(deps, loaded),
      ...(note !== undefined ? { note } : {}),
    },
  };
}
