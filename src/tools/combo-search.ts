import type { Result } from "../result.ts";
import type { HttpClient } from "../http/client.ts";
import type { SpellbookVariant, SpellbookVariantList } from "../spellbook/types.ts";
import { SPELLBOOK_LEGALITY_KEYS, resolveFormat, toComboSummary } from "../spellbook/combos.ts";
import type { ComboSummary } from "../spellbook/combos.ts";

export interface ComboSearchParams {
  /** Passed upstream byte-identically. Never parsed, validated, or rewritten. */
  q: string;
  page?: number;   // 1-based; default 1
  format?: string; // default "commander"; an unrecognized value is refused
}

export interface ComboSearchData {
  /** At most `PAGE_SIZE`, and never carrying `bucket` — that is `combo_find_deck`'s. */
  combos: ComboSummary[];
  total_combos: number;
  page: number;
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
 * Our page size, and the `limit` sent upstream (MCP-PRD CAP-02).
 *
 * CAP-01's 88-card half-page arithmetic DOES NOT TRANSFER. That shape exists because Scryfall's
 * `page` is in units of 175 with no offset, so a cap below 175 would strand cards behind no `page`
 * value at all. Commander Spellbook exposes a real `offset`, so there is no half-page trick, no
 * upstream-page anchoring, and `ceil(total / 40)` is simply correct here where its analogue was
 * wrong there. Reproducing Slice 14's arithmetic would be a bug.
 */
const PAGE_SIZE = 40;

/** How many of our pages a result spans. A true offset, so the naive form is the right one. */
function pageCount(total: number): number {
  return total <= 0 ? 0 : Math.ceil(total / PAGE_SIZE);
}

/**
 * `page` reaches here from `dispatchToolCall`, which admits any integer, and from direct calls
 * (MCP-PRD D-03) — the schema's `minimum: 1` is not enforced in code, so this defends itself.
 * An unclamped `page: 0` or `page: -5` would compute a negative offset and serve either nothing
 * or someone else's combos under a nonsense page number.
 */
function normalizePage(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return 1;
  const truncated = Math.trunc(raw);
  return truncated >= 1 ? truncated : 1;
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
 * A page past the end of a result we already hold. Reported as a failure rather than an empty
 * success so it never reads as "no combos match": upstream answers an out-of-range offset with an
 * HTTP 200 whose `results` is empty and whose `count` is unchanged, so a non-zero total beside an
 * empty page is exactly the signal that separates the two. Same treatment CAP-01 gives it.
 */
function outOfRangeFailure(page: number, total: number): Result<ComboSearchData> {
  const pages = pageCount(total);
  return {
    ok: false,
    error: {
      // No `status`: our determination from a 200 body, not an HTTP outcome.
      code: "bad_request",
      message:
        `Page ${page} is past the end of this result: ${total} combos match, which is ` +
        `${pages} page${pages === 1 ? "" : "s"} of ${PAGE_SIZE} (valid pages 1-${pages}). ` +
        `This is an out-of-range page, not a query that matched nothing.`,
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

/** The total, the range shown, and the page count. Only emitted when the total is trustworthy. */
function rangeNote(page: number, offset: number, shown: number, total: number): string {
  return (
    `${total} combos match; showing combos ${offset + 1}-${offset + shown} ` +
    `(page ${page} of ${pageCount(total)}). ` +
    `Narrow the query or request a specific page.`
  );
}

const DERIVED_TOTAL_NOTE =
  "Commander Spellbook did not report a total (`count` was absent or non-numeric), so " +
  "`total_combos` is derived from this page and may understate the true number; `has_more` " +
  "reflects upstream's own next-page link.";

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

  const page = normalizePage(params.page);
  const offset = (page - 1) * PAGE_SIZE;

  // (MCP-PRD D-10) the handler's own backstop, so it honours "never throws" standing alone and
  // not only in composition with a client that already guards itself.
  let result: Result<unknown>;
  try {
    result = await client.get("/variants/", {
      q: params.q, // byte-identical; encoding is the transport's job
      limit: String(PAGE_SIZE),
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
  // `limit=40` is the mechanism; this slice is the guarantee. An upstream that ignores or
  // redefines `limit` must not become a 400,000-character tool result.
  const shown: SpellbookVariant[] = list.results.slice(0, PAGE_SIZE);
  const total = countIsUsable ? (list.count as number) : offset + shown.length;

  if (shown.length === 0 && total > 0) return outOfRangeFailure(page, total);

  const first = shown[0];
  if (first !== undefined && typeof first.legalities[formatKey] !== "boolean") {
    return missingLegalityFailure(formatKey);
  }

  const combos = shown.map((variant) => toComboSummary(variant, formatKey));
  const has_more = list.next !== null || offset + combos.length < total;

  const data: ComboSearchData = {
    combos,
    total_combos: total,
    page,
    has_more,
    format: formatKey,
  };

  if (!countIsUsable) {
    // A derived total makes "page 1 of 1" a lie when `next` says otherwise, so the range note is
    // suppressed and the derivation is reported instead.
    data.note = DERIVED_TOTAL_NOTE;
  } else if (has_more || pageCount(total) > 1) {
    // Emitted on the last page too, where `has_more` is false but "page 3 of 3" is still the fact
    // the model needs.
    data.note = rangeNote(page, offset, combos.length, total);
  }

  return { ok: true, value: data };
}
