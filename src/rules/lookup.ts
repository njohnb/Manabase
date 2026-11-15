import type { Result } from "../result.ts";
import type { RuleEntry, RulesIndex } from "./parser.ts";

/**
 * Characters of rule entries one lookup may return. The same figure as the combo tools' page
 * budget, for the same reason (issue #25): section 7 alone is hundreds of kilobytes, and a
 * response past the harness ceiling is lost whole.
 */
export const RULES_BYTE_BUDGET = 50_000;

export interface RuleLookup {
  /** The requested rule first, then its descendants in document order. */
  rules: RuleEntry[];
  /** True when descendants were cut at the budget. Never a silent cut. */
  truncated: boolean;
  /** The first omitted rule, when `truncated`. Look it up (or a narrower number) to continue. */
  next_rule?: string;
}

const RULE_NUMBER = /^(\d{1,3}(?:\.\d+[a-z]*)?)$/;

/** Canonical number, or undefined. Accepts "Rule 702.19.", " 702.19B ". */
export function normalizeRuleNumber(input: string): string | undefined {
  const candidate = input.trim().replace(/^rule\s+/i, "").replace(/\.$/, "").toLowerCase();
  return RULE_NUMBER.test(candidate) ? candidate : undefined;
}

/**
 * Is `number` strictly under `parent`? Decided on a number BOUNDARY, never a bare prefix:
 * `702.190` is not under `702.19`.
 */
function isUnder(number: string, parent: string): boolean {
  if (/^\d$/.test(parent)) return /^\d{3}/.test(number) && number[0] === parent; // section 7 → 7xx
  if (/^\d{3}$/.test(parent)) return number.startsWith(`${parent}.`);           // 702 → 702.N…
  if (/^\d{3}\.\d+$/.test(parent)) return new RegExp(`^${parent.replace(".", "\\.")}[a-z]+$`).test(number);
  return false;                                                                  // a subrule has none
}

/** The refusal for input that is not a rule number, naming what one looks like. */
export function notARuleNumber(input: string): { ok: false; error: { code: "bad_request"; message: string } } {
  return {
    ok: false,
    error: {
      code: "bad_request",
      message:
        `"${input}" is not a Comprehensive Rules number. Pass a section, rule or subrule ` +
        'number such as "7", "702", "702.19" or "702.19a".',
    },
  };
}

/** Pure. A rule and every rule under it, filled to `RULES_BYTE_BUDGET`. */
export function lookupRule(index: RulesIndex, input: string): Result<RuleLookup> {
  const number = normalizeRuleNumber(input);
  if (number === undefined) return notARuleNumber(input);

  const start = index.positions.get(number);
  if (start === undefined) {
    return {
      ok: false,
      error: {
        code: "not_found",
        message:
          `There is no rule ${number} in the Comprehensive Rules effective ${index.effectiveDate}. ` +
          "Subrule letters skip l and o; check the number, or look up its parent rule.",
      },
    };
  }

  const first = index.rules[start]!;
  const rules: RuleEntry[] = [first];
  let bytes = JSON.stringify(first).length;
  for (let i = start + 1; i < index.rules.length; i++) {
    const entry = index.rules[i]!;
    if (!isUnder(entry.number, number)) break; // descendants are contiguous in document order
    const cost = JSON.stringify(entry).length + 1;
    if (bytes + cost > RULES_BYTE_BUDGET) {
      return { ok: true, value: { rules, truncated: true, next_rule: entry.number } };
    }
    rules.push(entry);
    bytes += cost;
  }
  return { ok: true, value: { rules, truncated: false } };
}
