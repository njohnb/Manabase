import type { Result } from "../result.ts";
import type { Clients } from "./register.ts";
import { resolveNames } from "../scryfall/collection.ts";
import type { SpellbookDeckResults, SpellbookFindMyCombos } from "../spellbook/types.ts";
import type { SpellbookVariant } from "../spellbook/types.ts";
import {
  SPELLBOOK_LEGALITY_KEYS,
  fillPage,
  resolveFormat,
  toComboSummary,
} from "../spellbook/combos.ts";
import type { ComboBucket, ComboSummary } from "../spellbook/combos.ts";

export type ComboInclude = "matched" | "matched+near";

export interface ComboFindDeckParams {
  /** Main-deck card NAMES. Required, non-empty. No quantities, no objects. */
  cards: string[];
  /** Commander names, kept separate because upstream does. Default []. */
  commanders?: string[];
  /** Default "matched". Near-misses are absent unless asked for. */
  include?: ComboInclude;
  /** 0-based index into the flattened classified list, NOT an upstream window. Default 0. */
  offset?: number;
  format?: string; // default "commander"; an unrecognized value is refused
}

export interface ComboFindDeckData {
  /** Filled to the shared byte budget, each carrying the bucket it came from. */
  combos: ComboSummary[];
  /** After classification and filtering — NOT upstream's `count`, which counts all six buckets. */
  total_combos: number;
  /** Where this page starts, echoing the request (0-based). */
  offset: number;
  /** Where the next page starts. Absent when `has_more` is false. */
  next_offset?: number;
  has_more: boolean;
  /** The value actually applied, so a caller never has to infer which question was answered. */
  include: ComboInclude;
  format: string;
  /** `results.identity` — read from inside `results`, not the envelope top level. */
  color_identity: string;
  /**
   * ALWAYS present, `[]` when none. An absent key would let "we checked and found no typos" and
   * "we did not check" read identically, which MCP-PRD §3.6 forbids. Not an optional property, so
   * no conditional spread applies to it.
   */
  unresolved_cards: string[];
  note?: string;
}

/**
 * The two buckets naming combos the deck ACTUALLY CONTAINS, in upstream's own order.
 *
 * `includedByChangingCommanders` and `almostIncludedByChangingCommanders` differ by one word and
 * mean opposite things, which is why the names cross this boundary verbatim and are never
 * translated into a local vocabulary.
 */
const MATCHED_BUCKETS: readonly ComboBucket[] = ["included", "includedByChangingCommanders"];

/** The four near-miss buckets, reached only under `include: "matched+near"`. */
const NEAR_BUCKETS: readonly ComboBucket[] = [
  "almostIncluded",
  "almostIncludedByAddingColors",
  "almostIncludedByChangingCommanders",
  "almostIncludedByAddingColorsAndChangingCommanders",
];

/** Upstream's own caps on a `DeckRequest` (MCP-PRD §4.4, verified). A 600-card list is a mistake. */
const MAX_MAIN = 600;
const MAX_COMMANDERS = 12;

/**
 * Mirrors `normalizeOffset` in `src/tools/combo-search.ts` deliberately, rather than importing
 * across two tool modules. `offset` reaches here from `dispatchToolCall`, which admits any integer,
 * and from direct calls (MCP-PRD D-03) — the schema's `minimum: 0` is not enforced in code, so this
 * defends itself. A negative offset would slice the classified list from a nonsense position.
 */
function normalizeOffset(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return 0;
  const truncated = Math.trunc(raw);
  return truncated >= 0 ? truncated : 0;
}

/**
 * Trim, and drop entries that are not names at all.
 *
 * This is NOT decklist parsing. A leading quantity survives untouched — `"1 Sol Ring"` goes
 * upstream as written and surfaces in `unresolved_cards`, which is loud and correct (MCP-PRD
 * CAP-02 criterion 5). What is dropped is only the empty and whitespace-only entry, which names no
 * card and would be submitted to Scryfall as an identifier matching nothing.
 */
function cleanNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const names: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (trimmed.length > 0) names.push(trimmed);
  }
  return names;
}

/** No `status`: our determination from the parameters, not an HTTP outcome. */
function unknownFormatFailure(requested: string): Result<ComboFindDeckData> {
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
 * No deck, no request. A `GET /find-my-combos` with no deck returns HTTP 200 carrying the ENTIRE
 * combo corpus as things this deck could almost reach, with `identity: "C"` and `included: []`
 * (MCP-PRD §4.4, verified 2026-08-24). It does not present as an error. Refusing here is what
 * stops a well-formed meaningless answer from reaching the model.
 */
function emptyDeckFailure(): Result<ComboFindDeckData> {
  return {
    ok: false,
    error: {
      code: "bad_request",
      message:
        "`cards` must be a non-empty array of card NAMES — the main deck. Nothing was requested " +
        "upstream, because a combo search with no deck returns every combo in Magic as a " +
        "near-miss rather than an error. Pass names only, with no quantities: " +
        '["Demonic Consultation", "Thassa\'s Oracle"], not ["1 Demonic Consultation"].',
    },
  };
}

/** Refused before the call rather than left to upstream, so the message names the real cap. */
function tooManyFailure(field: string, count: number, cap: number): Result<ComboFindDeckData> {
  return {
    ok: false,
    error: {
      code: "bad_request",
      message:
        `\`${field}\` carries ${count} entries and Commander Spellbook accepts at most ${cap}. ` +
        `Nothing was requested upstream. A list this long is a mistake rather than a deck — ` +
        `check that quantities were stripped and that only card names were sent.`,
    },
  };
}

/**
 * An offset past the end of the classified list. Reported as a failure rather than an empty
 * success so it never reads as "this deck has no combos" — the same distinction
 * `combo-search.ts`'s `outOfRangeFailure` exists to hold.
 */
function outOfRangeFailure(offset: number, total: number, include: ComboInclude): Result<ComboFindDeckData> {
  return {
    ok: false,
    error: {
      // No `status`: our determination from a 200 body, not an HTTP outcome.
      code: "bad_request",
      message:
        `Offset ${offset} is past the end of this result: ${total} combos match under ` +
        `\`include: "${include}"\`, so the valid offsets are 0-${total - 1}. This is an ` +
        `out-of-range offset, not a deck that matched nothing. Note that \`include\` changes the ` +
        "list an offset indexes — start at offset 0 and follow `next_offset`.",
    },
  };
}

/**
 * Upstream dropped the legality key we resolved. Reported rather than shaped, because an absent
 * key must never read as "not legal" (MCP-PRD §3.6) — and `legal: false` is exactly that claim.
 * Checked once per call against the first classified variant, not once per combo.
 */
function missingLegalityFailure(formatKey: string): Result<ComboFindDeckData> {
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

function unexpectedBodyFailure(): Result<ComboFindDeckData> {
  return {
    ok: false,
    error: {
      code: "unexpected",
      message:
        "Commander Spellbook returned a body that is not a deck combo result: `results` is not " +
        "the six-bucket object carrying a string `identity`. Nothing was classified from it.",
    },
  };
}

/**
 * Narrow the parsed body far enough to classify it. Never trusts the cast alone.
 *
 * `/find-my-combos` differs from `/variants/` in exactly this: `results` is an OBJECT of six
 * buckets, so an array here is the wrong endpoint's shape and is rejected. `identity` is checked
 * because it is reported to the caller, and a missing one would surface as `undefined` colour
 * identity rather than an error.
 */
function asFindMyCombos(value: unknown): SpellbookFindMyCombos | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const body = value as { results?: unknown };
  const results = body.results;
  if (typeof results !== "object" || results === null || Array.isArray(results)) return undefined;
  if (typeof (results as { identity?: unknown }).identity !== "string") return undefined;
  return value as SpellbookFindMyCombos;
}

/**
 * Flatten the buckets, MATCHED FIRST, always.
 *
 * The guarantee this buys is that a matched combo is never displaced by a near-miss. It is
 * ordering, not fitting: if the matched combos alone exceed the byte budget, later matched combos
 * land on page 2 — correct behaviour, since every one is still reachable by following
 * `next_offset`.
 *
 * Exactly six named keys are read, so an unknown SEVENTH bucket appearing upstream is ignored by
 * construction rather than crashing or being guessed into a category.
 */
function classify(
  results: SpellbookDeckResults,
  include: ComboInclude,
): Array<{ variant: SpellbookVariant; bucket: ComboBucket }> {
  const buckets =
    include === "matched+near" ? [...MATCHED_BUCKETS, ...NEAR_BUCKETS] : MATCHED_BUCKETS;

  const flattened: Array<{ variant: SpellbookVariant; bucket: ComboBucket }> = [];
  for (const bucket of buckets) {
    // Typed as `SpellbookVariant[]`, but the value came from JSON behind a cast: a bucket upstream
    // stopped sending would be `undefined` here, not an empty array.
    const variants: unknown = results[bucket];
    if (!Array.isArray(variants)) continue;
    for (const variant of variants as SpellbookVariant[]) flattened.push({ variant, bucket });
  }
  return flattened;
}

/** The total and the window shown, plus where to go next. */
function rangeNote(offset: number, shown: number, total: number, nextOffset: number | undefined): string {
  const range = `${total} combos match; showing combos ${offset + 1}-${offset + shown}`;
  return nextOffset === undefined
    ? `${range}. This is the last page.`
    : `${range}. Request \`offset: ${nextOffset}\` for the next page, keeping \`include\` and the ` +
      "decklist identical — changing either changes the list an offset indexes. Page size varies " +
      "with combo size, so always follow `next_offset` rather than assuming a fixed step.";
}

/**
 * This capability sends no `limit` and no `offset`, so upstream paginating anyway would silently
 * cost combos and understate `total_combos`. It has not been observed — the 164-variant capture
 * came back whole with `next: null` — and it is reported rather than assumed away.
 */
const UPSTREAM_PAGINATED_NOTE =
  "Commander Spellbook returned a next-page link for a request that asked for no page, so this " +
  "deck's combos may be incomplete and `total_combos` may understate the true number.";

/**
 * Find the combos a decklist already contains, and optionally the ones it is one card away from.
 *
 * The shape of this tool is decided by three measured upstream behaviours, all of them silent:
 *
 *   1. `/find-my-combos`'s own `limit` DOES NOT PRIORITIZE the combos the deck contains. At
 *      `limit=5` the response held 4 matched and 1 near while the true first eight were all
 *      matched (MCP-PRD §4.4). So `limit` and `offset` are NEVER sent upstream: the full result is
 *      fetched, classified, and capped AFTER. A capped upstream request is not a smaller correct
 *      answer, it is a wrong answer that looks right.
 *   2. An unrecognized card name is SILENTLY IGNORED — HTTP 200, no warning, no unresolved list,
 *      and no endpoint this source serves will say so. Every submitted name is therefore resolved
 *      through Scryfall's `POST /cards/collection` first, and the misses are reported. That is the
 *      only reason this capability touches Scryfall.
 *   3. A request with no deck returns HTTP 200 carrying the entire combo corpus as near-misses, so
 *      an empty decklist is refused before any call rather than answered.
 *
 * The wire budget and the model budget are different budgets: 640,684 characters crossed the
 * network in 1.66 seconds on the measured deck. The byte budget constrains what reaches the model,
 * not what crosses the wire, and conflating the two is what would push the cap upstream.
 *
 * One upstream combo request per tool call, always. Paging re-fetches and re-classifies rather than
 * holding state, because this server keeps no per-user state (MCP-PRD D-03) — there is no cursor.
 * Offsets are stable only because upstream classification is deterministic: the same request twice
 * was byte-identical (MCP-PRD §4.4). That is a DIFFERENT verified fact from `combo_search`'s, which
 * rests on `/variants/` ordering probed live 2026-08-25; neither is evidence for the other.
 *
 * Never throws (MCP-PRD D-10).
 */
export async function comboFindDeck(
  clients: Clients,
  params: ComboFindDeckParams,
): Promise<Result<ComboFindDeckData>> {
  // Resolved BEFORE any upstream call, and reused from Slice 16 unchanged: a format this source
  // cannot judge is refused rather than answered from a different format (MCP-PRD §3.6).
  const formatKey = resolveFormat(params.format);
  if (formatKey === undefined) return unknownFormatFailure(params.format ?? "");

  const cards = cleanNames(params.cards);
  const commanders = cleanNames(params.commanders);

  // Both refusals below issue ZERO calls to either source — not even name resolution.
  if (cards.length === 0) return emptyDeckFailure();
  if (cards.length > MAX_MAIN) return tooManyFailure("cards", cards.length, MAX_MAIN);
  if (commanders.length > MAX_COMMANDERS) {
    return tooManyFailure("commanders", commanders.length, MAX_COMMANDERS);
  }

  const include: ComboInclude = params.include === "matched+near" ? "matched+near" : "matched";
  const offset = normalizeOffset(params.offset);

  // A name-resolution FAILURE is not a combo-search failure, and the two must not collapse. If the
  // batch call itself fails we return that rather than proceeding blind; a successful resolution
  // that merely finds misses proceeds normally with the misses reported.
  const resolution = await resolveNames(clients.scryfall, [...cards, ...commanders]);
  if (!resolution.ok) return resolution;

  // The names go up AS SUBMITTED, including the ones Scryfall rejected. Dropping a name we could
  // not resolve would change the deck the user asked about, silently, on our own initiative — and
  // Commander Spellbook matching against Scryfall's canonical names is recorded as inferred, not
  // verified (MCP-PRD §4.4), so acting on Scryfall's say-so would rest on an unverified premise.
  //
  // `quantity` is sent because the verified `DeckRequest` shape carries it (MCP-PRD §4.4). It is
  // always 1: across the 260 captured variants there were 762 `uses`/`requires` entries and ZERO
  // with a quantity other than 1, so quantity carries no combo information.
  const body = {
    main: cards.map((card) => ({ card, quantity: 1 })),
    commanders: commanders.map((card) => ({ card, quantity: 1 })),
  };

  // (MCP-PRD D-10) the handler's own backstop, so it honours "never throws" standing alone and not
  // only in composition with a client that already guards itself.
  let result: Result<unknown>;
  try {
    // No `limit`, no `offset`, no query string at all. See behaviour 1 above; this is the line an
    // optimization would change, and changing it returns a plausible answer missing the user's
    // actual combos.
    result = await clients.spellbook.post("/find-my-combos", body);
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

  // Passed through unchanged, with Commander Spellbook's details verbatim. There is deliberately no
  // 404-to-empty mapping: this source answers a valid request with no matches as an HTTP 200, so a
  // 404 means a bad path and converting it would report "no combos" for a broken request.
  if (!result.ok) return result;

  const found = asFindMyCombos(result.value);
  if (found === undefined) return unexpectedBodyFailure();

  const flattened = classify(found.results, include);
  const total_combos = flattened.length;

  // An out-of-range offset and a deck that matches nothing are different outcomes. A deck matching
  // nothing is a SUCCESSFUL EMPTY RESULT with `total_combos: 0`.
  if (total_combos > 0 && offset >= total_combos) {
    return outOfRangeFailure(offset, total_combos, include);
  }

  const first = flattened[0];
  if (first !== undefined && typeof first.variant.legalities[formatKey] !== "boolean") {
    return missingLegalityFailure(formatKey);
  }

  // `unresolved_cards` scales with the input — one entry per submitted name Scryfall did not
  // resolve — so its size is reserved against the budget rather than left to the flat envelope
  // allowance, which is sized for the constant keys only.
  const unresolved = resolution.value.unresolved;
  const combos = fillPage(
    flattened.slice(offset).map(({ variant, bucket }) => toComboSummary(variant, formatKey, bucket)),
    JSON.stringify(unresolved).length,
  );

  const has_more = offset + combos.length < total_combos;
  const nextOffset = has_more ? offset + combos.length : undefined;

  const data: ComboFindDeckData = {
    combos,
    total_combos,
    offset,
    ...(nextOffset !== undefined ? { next_offset: nextOffset } : {}),
    has_more,
    include,
    format: formatKey,
    color_identity: found.results.identity,
    unresolved_cards: unresolved,
  };

  const notes: string[] = [];
  if (found.next !== null) notes.push(UPSTREAM_PAGINATED_NOTE);
  if (combos.length > 0 && (has_more || offset > 0)) {
    notes.push(rangeNote(offset, combos.length, total_combos, nextOffset));
  }
  if (notes.length > 0) data.note = notes.join(" ");

  return { ok: true, value: data };
}
