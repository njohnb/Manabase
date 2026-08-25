import type { Result } from "../result.ts";
import type { HttpClient } from "../http/client.ts";
import type { SpellbookVariantList } from "../spellbook/types.ts";
import { SPELLBOOK_LEGALITY_KEYS, resolveFormat, toComboSummary } from "../spellbook/combos.ts";
import type { ComboSummary } from "../spellbook/combos.ts";

export interface ComboSearchParams {
  /** Passed upstream byte-identically. Never parsed, validated, or rewritten. */
  q: string;
  /** 0-based, in combos. Default 0. Take it from the previous response's `next_offset`. */
  offset?: number;
  format?: string; // default "commander"; an unrecognized value is refused
}

export interface ComboSearchData {
  /** Filled to `BYTE_BUDGET`, never carrying `bucket` — that is `combo_find_deck`'s. */
  combos: ComboSummary[];
  total_combos: number;
  /** Where this page starts, echoing the request (0-based). */
  offset: number;
  /**
   * Where the NEXT page starts. Absent when `has_more` is false.
   *
   * This exists because the page size is not constant: pages are filled to a byte budget, so the
   * caller cannot compute the next start from a page number. Echo this value back as `offset`.
   */
  next_offset?: number;
  has_more: boolean;
  /**
   * The format legality was judged for. ALWAYS the one requested: `resolveFormat` refuses
   * anything this source cannot judge, so unlike CAP-01's `legalities_mode` there is no
   * applied-versus-requested gap here. Do not add one.
   */
  format: string;
  /** Present when the model should act: more pages exist, or the total is derived. */
  note?: string;
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
 */
const BYTE_BUDGET = 50_000;

/**
 * How many variants to ask upstream for. Not the page size — the page size is whatever fits.
 *
 * 60 fills the budget for every query except the very cheapest, and costs 20.4 KB gzipped against
 * 7.1 KB for 20 (measured 2026-08-25; the API serves `content-encoding: gzip`). Fetching more than
 * is returned is deliberate and cheap: MCP-PRD §4.4.1's "the wire budget and the model budget are
 * different budgets". It cannot be avoided by asking for less, either — `/variants/` ignores
 * `fields=`, `fields[]=`, `only=` and `omit=`, so the ten `imageUri*` fields worth 41.9% of the
 * payload arrive on every call whatever we do.
 *
 * Fewer, larger requests is also the direction §3.4 and §3.7 care about: they constrain request
 * RATE against a source that publishes no limit, and this makes a 96-combo sweep 2 requests
 * rather than 5.
 */
const UPSTREAM_LIMIT = 60;

/**
 * Reserved for the keys around `combos` — `total_combos`, `offset`, `next_offset`, `has_more`,
 * `format` and the longest `note` this module emits. Deliberately generous: overshooting the
 * budget matters and under-filling a page by a few hundred bytes does not.
 */
const ENVELOPE_RESERVE = 400;

/**
 * `offset` reaches here from `dispatchToolCall`, which admits any integer, and from direct calls
 * (MCP-PRD D-03) — the schema's `minimum: 0` is not enforced in code, so this defends itself. A
 * negative offset would ask upstream for a nonsense window.
 */
function normalizeOffset(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return 0;
  const truncated = Math.trunc(raw);
  return truncated >= 0 ? truncated : 0;
}

/** No `status`: our determination from the parameters, not an HTTP outcome. */
function unknownFormatFailure(requested: string): Result<ComboSearchData> {
  return {
    ok: false,
    error: {
      code: "bad_request",
      message:
        `Commander Spellbook cannot judge the format "${requested}". It reports legality for ` +
        `these 16 formats only: ${SPELLBOOK_LEGALITY_KEYS.join(", ")} (plus the alias "edh" for ` +
        `commander). These names are NOT Scryfall's — note the capital in "standardBrawl", and ` +
        `that historic, timeless, penny, duel, future, gladiator, oldschool and tlr do not exist ` +
        `here at all. Request one of the listed formats.`,
    },
  };
}

/**
 * An offset past the end of a result we already hold. Reported as a failure rather than an empty
 * success so it never reads as "no combos match": upstream answers an out-of-range offset with an
 * HTTP 200 whose `results` is empty and whose `count` is unchanged, so a non-zero total beside an
 * empty window is exactly the signal that separates the two. Same treatment CAP-01 gives it.
 */
function outOfRangeFailure(offset: number, total: number): Result<ComboSearchData> {
  return {
    ok: false,
    error: {
      // No `status`: our determination from a 200 body, not an HTTP outcome.
      code: "bad_request",
      message:
        `Offset ${offset} is past the end of this result: ${total} combos match, so the valid ` +
        `offsets are 0-${total - 1}. This is an out-of-range offset, not a query that matched ` +
        `nothing. Start at offset 0 and follow \`next_offset\`.`,
    },
  };
}

/**
 * Upstream dropped the legality key we resolved. Reported rather than shaped, because an absent
 * key must never read as "not legal" (MCP-PRD §3.6) — and `legal: false` is exactly that claim.
 * Checked once per call against the first variant, not once per combo.
 */
function missingLegalityFailure(formatKey: string): Result<ComboSearchData> {
  return {
    ok: false,
    error: {
      code: "unexpected",
      message:
        `Commander Spellbook returned no "${formatKey}" legality on these combos, so legality ` +
        `cannot be reported for the format requested. Reporting false here would claim the ` +
        `combos are illegal, which is not what an absent key means.`,
    },
  };
}

function unexpectedBodyFailure(): Result<ComboSearchData> {
  return {
    ok: false,
    error: {
      code: "unexpected",
      message:
        "Commander Spellbook returned a body that is not a variant list: no `results` array. " +
        "Nothing was shaped from it.",
    },
  };
}

/** Narrow the parsed body far enough to shape it. Never trusts the cast alone. */
function asVariantList(value: unknown): SpellbookVariantList | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const body = value as { results?: unknown };
  return Array.isArray(body.results) ? (value as SpellbookVariantList) : undefined;
}

const DERIVED_TOTAL_NOTE =
  "Commander Spellbook did not report a total (`count` was absent or non-numeric), so " +
  "`total_combos` is derived from this page and may understate the true number; `has_more` " +
  "reflects upstream's own next-page link.";

/**
 * Shape variants until the byte budget is spent.
 *
 * The `kept.length > 0` guard is load-bearing, not defensive tidiness: a single combo larger than
 * the whole budget must still be returned, or `next_offset` never advances past it and the caller
 * pages forever on an empty result. One oversized combo is a big response; a non-advancing offset
 * is an infinite loop.
 */
function fillPage(list: SpellbookVariantList, formatKey: string): ComboSummary[] {
  const kept: ComboSummary[] = [];
  let bytes = ENVELOPE_RESERVE;

  for (const variant of list.results) {
    const summary = toComboSummary(variant, formatKey);
    const cost = JSON.stringify(summary).length + 1; // +1 for the separating comma
    if (kept.length > 0 && bytes + cost > BYTE_BUDGET) break;
    kept.push(summary);
    bytes += cost;
  }

  return kept;
}

/** The total and the window shown, plus where to go next. */
function rangeNote(offset: number, shown: number, total: number, nextOffset: number | undefined): string {
  const range = `${total} combos match; showing combos ${offset + 1}-${offset + shown}`;
  return nextOffset === undefined
    ? `${range}. This is the last page.`
    : `${range}. Request \`offset: ${nextOffset}\` for the next page. Page size varies with combo ` +
      `size, so always follow \`next_offset\` rather than assuming a fixed step.`;
}

/**
 * Evaluate a Commander Spellbook query and return shaped combos.
 *
 * The query is sent verbatim — no parsing, validation, or rewriting (MCP-PRD D-07); Commander
 * Spellbook owns the query language, and unlike Scryfall it rejects an unrecognized operator
 * loudly with HTTP 400 naming the character position, so the model self-corrects from
 * `Failure.details` on the next call. Exactly one upstream request per tool call: pagination is
 * reported, never resolved, and no further page is ever auto-fetched. Never throws
 * (MCP-PRD D-10).
 *
 * Paging is by OFFSET, not page number, because the page size is not constant — see BYTE_BUDGET.
 * CAP-01's 88-card half-page arithmetic does not transfer and neither does its page numbering:
 * Scryfall's `page` is in units of 175 with no offset, so its cap had to divide a page evenly or
 * strand cards. Commander Spellbook exposes a real `offset`, which is what lets a page end
 * wherever the budget runs out with nothing stranded behind it.
 *
 * Two behaviours are deliberately the OPPOSITE of CAP-01's and are easy to port by mistake:
 * zero matches arrives as HTTP 200 and is a successful empty result, while a 404 means a bad
 * path and stays a failure.
 */
export async function comboSearch(
  client: HttpClient,
  params: ComboSearchParams,
): Promise<Result<ComboSearchData>> {
  // Resolved BEFORE any upstream call: a format this source cannot judge is refused rather than
  // answered from a different format (MCP-PRD §3.6, Slice 16 requirement 7).
  const formatKey = resolveFormat(params.format);
  if (formatKey === undefined) return unknownFormatFailure(params.format ?? "");

  const offset = normalizeOffset(params.offset);

  // (MCP-PRD D-10) the handler's own backstop, so it honours "never throws" standing alone and
  // not only in composition with a client that already guards itself.
  let result: Result<unknown>;
  try {
    result = await client.get("/variants/", {
      q: params.q, // byte-identical; encoding is the transport's job
      limit: String(UPSTREAM_LIMIT),
      offset: String(offset),
      // Without this, `count` comes back null with the key PRESENT — a missing total that does
      // not announce itself (MCP-PRD §4.4, verified 2026-08-24). Criterion 8 needs the total.
      count: "true",
    });
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "unexpected",
        message: `Unexpected failure searching Commander Spellbook: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
    };
  }

  // Everything passes through unchanged, with Commander Spellbook's details verbatim. There is
  // deliberately NO 404-to-empty mapping: this source answers a valid query with no matches as an
  // HTTP 200, so a 404 means a bad path and converting it would report "no combos match" for a
  // broken request.
  if (!result.ok) return result;

  const list = asVariantList(result.value);
  if (list === undefined) return unexpectedBodyFailure();

  const countIsUsable = typeof list.count === "number" && Number.isFinite(list.count);
  const total = countIsUsable ? (list.count as number) : offset + list.results.length;

  if (list.results.length === 0 && total > 0) return outOfRangeFailure(offset, total);

  const first = list.results[0];
  if (first !== undefined && typeof first.legalities[formatKey] !== "boolean") {
    return missingLegalityFailure(formatKey);
  }

  const combos = fillPage(list, formatKey);

  // Three independent reasons more may exist, and the first is the one a fixed cap never had:
  // the budget can end a page inside a window we already hold.
  const truncatedLocally = combos.length < list.results.length;
  const has_more = truncatedLocally || list.next !== null || offset + combos.length < total;
  const nextOffset = has_more ? offset + combos.length : undefined;

  const data: ComboSearchData = {
    combos,
    total_combos: total,
    offset,
    ...(nextOffset !== undefined ? { next_offset: nextOffset } : {}),
    has_more,
    format: formatKey,
  };

  if (!countIsUsable) {
    // A derived total would make a range note claim a total it does not know, so the derivation
    // is reported instead.
    data.note = DERIVED_TOTAL_NOTE;
  } else if (combos.length > 0 && (has_more || offset > 0)) {
    data.note = rangeNote(offset, combos.length, total, nextOffset);
  }

  return { ok: true, value: data };
}
