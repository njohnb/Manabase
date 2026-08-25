import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Failure, Result } from "../../src/result.ts";
import type { SpellbookClient } from "../../src/spellbook/client.ts";
import type { SpellbookVariant, SpellbookVariantList } from "../../src/spellbook/types.ts";
import { comboSearch } from "../../src/tools/combo-search.ts";

// Loaded at runtime, like every other suite here.
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
}

/** Verbatim: 40 variants, `count` 96, `next` populated. ~1,001 characters per shaped combo. */
const page1 = fixture("spellbook/variants-page1.json") as SpellbookVariantList;
/** DERIVED: the real offset=40 response truncated to 8. `count` is still the captured 96. */
const page2 = fixture("spellbook/variants-page2.json") as SpellbookVariantList;
const empty = fixture("spellbook/variants-empty.json") as SpellbookVariantList;
/** Verbatim HTTP 400 body: `{"q":["Invalid search query: unexpected character : at position 34."]}` */
const invalidQuery400 = fixture("spellbook/variants-invalid-query-400.json") as Record<string, string[]>;

/** Mirrors BYTE_BUDGET / UPSTREAM_LIMIT in src/tools/combo-search.ts. */
const BYTE_BUDGET = 50_000;
const UPSTREAM_LIMIT = 60;

interface RecordedCall {
  path: string;
  query: Record<string, string | undefined> | undefined;
}

/**
 * `comboSearch` reaches Commander Spellbook by GET only. `post` exists because `SpellbookClient`
 * is the shared `HttpClient`; it rejects so an accidental POST fails loudly rather than returning
 * something plausible. `/find-my-combos` is Slice 17's.
 */
const refusePost = (path: string): Promise<never> =>
  Promise.reject(new Error(`fake client: comboSearch must not POST (${path})`));

/** Object-literal client that records its arguments and returns a canned Result. */
function makeFakeClient(result: Result<unknown>): { client: SpellbookClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const client: SpellbookClient = {
    get(path, query) {
      calls.push({ path, query });
      return Promise.resolve(result);
    },
    post: refusePost,
  };
  return { client, calls };
}

/**
 * Scripted client: the Nth `get` returns `script[N]`. An unscripted call REJECTS rather than
 * returning something plausible — an extra upstream request is exactly the auto-paging bug this
 * tool must not introduce, and a lenient fake hides it.
 */
function makeScriptedClient(script: Array<Result<unknown>>): {
  client: SpellbookClient;
  calls: RecordedCall[];
} {
  const queue = [...script];
  const calls: RecordedCall[] = [];
  const client: SpellbookClient = {
    get(path, query) {
      calls.push({ path, query });
      const next = queue.shift();
      if (next === undefined) {
        return Promise.reject(
          new Error(`scripted client: script exhausted at call ${calls.length} to ${path}`),
        );
      }
      return Promise.resolve(next);
    },
    post: refusePost,
  };
  return { client, calls };
}

const failure = (
  code: Failure["error"]["code"],
  message: string,
  extra?: { status?: number; details?: string },
): Failure => {
  const error: Failure["error"] = { code, message };
  if (extra?.status !== undefined) error.status = extra.status;
  if (extra?.details !== undefined) error.details = extra.details;
  return { ok: false, error };
};

/** An envelope of `n` variants cycling the page-1 pool, with distinguishable ids. */
function envelope(
  n: number,
  opts: { count: number | null; next?: string | null },
): SpellbookVariantList {
  const pool = page1.results;
  return {
    count: opts.count,
    next: opts.next ?? null,
    previous: null,
    results: Array.from({ length: n }, (_, i) => ({
      ...pool[i % pool.length]!,
      id: `synthetic-${i + 1}`,
    })),
  };
}

/**
 * An envelope whose variants are deliberately expensive, by padding `description` — the field
 * that dominates the trimmed form. Synthesized rather than captured: no committed fixture carries
 * a combo near the 4,421-character maximum measured live on 2026-08-25.
 */
function expensiveEnvelope(
  n: number,
  charsEach: number,
  opts: { count: number | null; next?: string | null },
): SpellbookVariantList {
  const base = page1.results[0]!;
  return {
    count: opts.count,
    next: opts.next ?? null,
    previous: null,
    results: Array.from({ length: n }, (_, i): SpellbookVariant => ({
      ...base,
      id: `costly-${i + 1}`,
      description: "x".repeat(charsEach),
    })),
  };
}

describe("comboSearch — the query passes through byte-identically", () => {
  test("[CAP-02 #2] an operator this server has never heard of goes out unchanged", async () => {
    // The claim "we pass it through" is exactly the kind that quietly stops being true.
    const q = 'nonsenseop:foo card:"Thassa\'s Oracle"';
    const { client, calls } = makeFakeClient({ ok: true, value: page1 });

    await comboSearch(client, { q });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.path, "/variants/");
    assert.equal(calls[0]!.query!.q, q);
  });

  test("[CAP-02 #2] quotes, spaces and colons survive untouched", async () => {
    const q = 'card:"Demonic Consultation" AND result:"Win the game" -banned:legacy';
    const { client, calls } = makeFakeClient({ ok: true, value: page1 });

    await comboSearch(client, { q });

    assert.equal(calls[0]!.query!.q, q);
    // No normalization of any kind: byte-for-byte, same length, same characters.
    assert.equal(calls[0]!.query!.q!.length, q.length);
  });

  test("no parse, no rewrite: a syntactically broken query is still sent", async () => {
    const q = 'card:"unclosed quote';
    const { client, calls } = makeFakeClient({
      ok: false,
      error: { code: "bad_request", message: "Commander Spellbook rejected the request as malformed.", status: 400 },
    });

    await comboSearch(client, { q });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.query!.q, q);
  });
});

describe("comboSearch — paging is by offset", () => {
  test("[CAP-02 #8] the first call sends limit=60, offset=0 and count=true", async () => {
    const { client, calls } = makeFakeClient({ ok: true, value: page1 });

    const result = await comboSearch(client, { q: 'card:"Thassa\'s Oracle"' });

    assert.ok(result.ok);
    assert.deepEqual(calls[0]!.query, {
      q: 'card:"Thassa\'s Oracle"',
      limit: String(UPSTREAM_LIMIT),
      offset: "0",
      count: "true",
    });
    assert.equal(result.value.offset, 0);
    assert.equal(result.value.total_combos, 96);
    assert.equal(result.value.has_more, true);
  });

  test("[CAP-02 #8] `offset` passes through unchanged — no page arithmetic", async () => {
    // Nothing multiplies or divides the caller's offset. The page size is not constant, so any
    // arithmetic over it would be wrong by construction.
    for (const offset of [0, 1, 17, 40, 500]) {
      const { client, calls } = makeFakeClient({ ok: true, value: envelope(60, { count: 1000 }) });
      const result = await comboSearch(client, { q: "x", offset });
      assert.ok(result.ok, `offset ${offset}`);
      assert.equal(calls[0]!.query!.offset, String(offset));
      assert.equal(result.value.offset, offset);
    }
  });

  test("[CAP-02 #8] a later offset returns different combos", async () => {
    const { client: c1 } = makeFakeClient({ ok: true, value: page1 });
    const first = await comboSearch(c1, { q: "x" });

    const { client: c2, calls } = makeFakeClient({ ok: true, value: page2 });
    const second = await comboSearch(c2, { q: "x", offset: 40 });

    assert.equal(calls[0]!.query!.offset, "40");
    assert.ok(first.ok && second.ok);

    const firstIds = new Set(first.value.combos.map((c) => c.id));
    const secondIds = second.value.combos.map((c) => c.id);
    assert.ok(secondIds.length > 0);
    for (const id of secondIds) assert.equal(firstIds.has(id), false, `id ${id} repeated`);
    assert.equal(second.value.offset, 40);
  });

  test("`next_offset` advances by exactly the combos returned", async () => {
    // The contract the caller depends on: echo `next_offset` back and nothing is skipped or
    // repeated, whatever the page size turned out to be.
    const { client } = makeFakeClient({ ok: true, value: expensiveEnvelope(60, 5_000, { count: 500 }) });

    const result = await comboSearch(client, { q: "x", offset: 12 });

    assert.ok(result.ok);
    assert.equal(result.value.next_offset, 12 + result.value.combos.length);
    assert.equal(result.value.has_more, true);
  });

  test("`next_offset` is ABSENT on the last page, never a dead-end number", async () => {
    const last = envelope(5, { count: 5, next: null });
    const { client } = makeFakeClient({ ok: true, value: last });

    const result = await comboSearch(client, { q: "x" });

    assert.ok(result.ok);
    assert.equal(result.value.has_more, false);
    assert.equal("next_offset" in result.value, false);
  });

  test("a negative, fractional or absent offset defends itself and never goes negative", async () => {
    for (const offset of [undefined, -1, -500, 1.7, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { client, calls } = makeFakeClient({ ok: true, value: page1 });
      const result = await comboSearch(client, {
        q: "x",
        ...(offset !== undefined ? { offset } : {}),
      });
      assert.ok(result.ok, `offset ${String(offset)}`);
      assert.ok(Number(calls[0]!.query!.offset) >= 0, `offset ${String(offset)}`);
      assert.ok(result.value.offset >= 0);
    }
  });

  test("[CAP-02 #8] one tool call is one upstream request — never auto-paged", async () => {
    // The scripted client rejects a second call, so an auto-page would fail loudly here.
    const { client, calls } = makeScriptedClient([{ ok: true, value: page1 }]);

    const result = await comboSearch(client, { q: "x" });

    assert.ok(result.ok);
    assert.equal(calls.length, 1);
  });

  test("has_more is false when the window is the whole result", async () => {
    const { client } = makeFakeClient({ ok: true, value: envelope(16, { count: 96, next: null }) });

    const result = await comboSearch(client, { q: "x", offset: 80 });

    assert.ok(result.ok);
    assert.equal(result.value.combos.length, 16);
    assert.equal(result.value.has_more, false);
    assert.equal(result.value.total_combos, 96);
  });
});

describe("comboSearch — the byte budget", () => {
  test("[requirement 6] a page never exceeds the budget once more than one combo fits", async () => {
    // 60 variants at ~5,000 characters each is 300,000 raw; the budget is what stops it.
    const { client } = makeFakeClient({ ok: true, value: expensiveEnvelope(60, 5_000, { count: 500 }) });

    const result = await comboSearch(client, { q: "x" });

    assert.ok(result.ok);
    const chars = JSON.stringify(result.value).length;
    assert.ok(chars <= BYTE_BUDGET, `page measured ${chars}, over the ${BYTE_BUDGET} budget`);
    assert.ok(result.value.combos.length > 1);
    assert.ok(result.value.combos.length < 60, "the budget did not bite");
    assert.equal(result.value.has_more, true);
  });

  test("[requirement 6] a cheap query fills the page with far more than a fixed cap would", async () => {
    // The point of the budget: ~1,001 characters per combo means the whole 40-variant fixture
    // fits, where the retired fixed cap of 20 would have returned half of it.
    const { client } = makeFakeClient({ ok: true, value: page1 });

    const result = await comboSearch(client, { q: "x" });

    assert.ok(result.ok);
    assert.equal(result.value.combos.length, 40);
    assert.ok(JSON.stringify(result.value).length <= BYTE_BUDGET);
  });

  test("a single combo larger than the whole budget is STILL returned", async () => {
    // The load-bearing guard. Returning zero would leave `next_offset` equal to `offset`, and the
    // caller would page forever on an empty result — an infinite loop is worse than a big page.
    const { client } = makeFakeClient({
      ok: true,
      value: expensiveEnvelope(3, BYTE_BUDGET * 2, { count: 3 }),
    });

    const result = await comboSearch(client, { q: "x" });

    assert.ok(result.ok);
    assert.equal(result.value.combos.length, 1);
    assert.equal(result.value.next_offset, 1, "next_offset must advance past an oversized combo");
    assert.equal(result.value.has_more, true);
    assert.ok(JSON.stringify(result.value).length > BYTE_BUDGET); // deliberately over
  });

  test("truncating inside a window we already hold still reports has_more", async () => {
    // `next` is null and the count is satisfied by the window, so the ONLY signal that more
    // exist is that the budget ended the page early. A fixed cap never had this case.
    const { client } = makeFakeClient({
      ok: true,
      value: expensiveEnvelope(60, 5_000, { count: 60, next: null }),
    });

    const result = await comboSearch(client, { q: "x" });

    assert.ok(result.ok);
    assert.ok(result.value.combos.length < 60);
    assert.equal(result.value.has_more, true);
    assert.equal(result.value.next_offset, result.value.combos.length);
  });

  test("paging an expensive result by next_offset reaches every combo exactly once", async () => {
    // The end-to-end reachability claim, driven through repeated calls the way a caller would.
    const total = 45;
    const all = expensiveEnvelope(total, 5_000, { count: total, next: null });
    const seen: string[] = [];
    let offset = 0;

    for (let guard = 0; guard < 20; guard += 1) {
      const window: SpellbookVariantList = {
        count: total,
        next: null,
        previous: null,
        results: all.results.slice(offset, offset + UPSTREAM_LIMIT),
      };
      const { client } = makeFakeClient({ ok: true, value: window });
      const result = await comboSearch(client, { q: "x", offset });
      assert.ok(result.ok);
      seen.push(...result.value.combos.map((c) => c.id));
      if (!result.value.has_more) break;
      assert.ok(result.value.next_offset! > offset, "offset must strictly advance");
      offset = result.value.next_offset!;
    }

    assert.equal(seen.length, total, "every combo reachable exactly once");
    assert.equal(new Set(seen).size, total, "no combo repeated");
  });
});

describe("comboSearch — count=true and the total", () => {
  test("[requirement 4] every outgoing request carries count=true", async () => {
    for (const params of [{ q: "x" }, { q: "x", offset: 40 }, { q: "x", format: "modern" }]) {
      const { client, calls } = makeFakeClient({ ok: true, value: page1 });
      await comboSearch(client, params);
      assert.equal(calls[0]!.query!.count, "true");
    }
  });

  test("[requirement 4] a null count never reports total_combos: 0 beside real combos", async () => {
    // Without `count=true` upstream returns `count: null` with the key PRESENT, so a missing
    // total does not announce itself — it reads as a total of nothing.
    const { client } = makeFakeClient({
      ok: true,
      value: envelope(40, { count: null, next: "https://backend.commanderspellbook.com/variants/?offset=40" }),
    });

    const result = await comboSearch(client, { q: "x" });

    assert.ok(result.ok);
    assert.ok(result.value.combos.length > 0);
    assert.notEqual(result.value.total_combos, 0);
    assert.equal(result.value.total_combos, 40); // derived from what was returned
    assert.ok(result.value.note);
    assert.match(result.value.note, /count/i);
    // `next` still says more exist, so the response must not claim this is everything.
    assert.equal(result.value.has_more, true);
  });

  test("[requirement 4] a non-numeric count is treated the same way", async () => {
    const broken = { ...envelope(3, { count: null }), count: "96" } as unknown as SpellbookVariantList;
    const { client } = makeFakeClient({ ok: true, value: broken });

    const result = await comboSearch(client, { q: "x" });

    assert.ok(result.ok);
    assert.equal(result.value.total_combos, 3);
    assert.ok(result.value.note);
  });
});

describe("comboSearch — zero matches, and what must NOT be mapped to it", () => {
  test("[requirement 5] an empty 200 is a successful empty result", async () => {
    assert.equal(empty.count, 0);
    assert.deepEqual(empty.results, []);
    const { client } = makeFakeClient({ ok: true, value: empty });

    const result = await comboSearch(client, { q: 'card:"Zzzz Not A Real Card 9999"' });

    assert.ok(result.ok);
    assert.deepEqual(result.value.combos, []);
    assert.equal(result.value.total_combos, 0);
    assert.equal(result.value.has_more, false);
    assert.equal("next_offset" in result.value, false);
    assert.equal(result.value.format, "commander");
  });

  test("[requirement 5] a 404 STAYS a failure — CAP-01's mapping is not ported", async () => {
    // Commander Spellbook answers a valid query with no matches as HTTP 200. A 404 from this host
    // means a bad path, and converting it to an empty success would report "no combos match" for
    // a broken request. This is the single easiest thing in the slice to get backwards.
    const { client } = makeFakeClient(
      failure("not_found", "Commander Spellbook found no match for the request.", { status: 404 }),
    );

    const result = await comboSearch(client, { q: "x" });

    assert.ok(!result.ok);
    assert.equal(result.error.code, "not_found");
    assert.equal(result.error.status, 404);
  });
});

describe("comboSearch — an offset past the end", () => {
  test("an empty window with a non-zero total is bad_request, not an empty success", async () => {
    // Distinguishable from zero matches exactly as CAP-01 distinguishes it: `count > 0` with no
    // results is an out-of-range offset, not a query that matched nothing.
    const { client } = makeFakeClient({ ok: true, value: envelope(0, { count: 96, next: null }) });

    const result = await comboSearch(client, { q: "x", offset: 500 });

    assert.ok(!result.ok);
    assert.equal(result.error.code, "bad_request");
    assert.match(result.error.message, /96 combos match/);
    assert.match(result.error.message, /valid offsets are 0-95/);
    // No `status`: our determination from a 200 body, not an HTTP outcome.
    assert.equal("status" in result.error, false);
  });

  test("the valid range is stated in combos, not pages", async () => {
    for (const total of [1, 40, 96, 176]) {
      const { client } = makeFakeClient({ ok: true, value: envelope(0, { count: total }) });
      const result = await comboSearch(client, { q: "x", offset: 9_999 });
      assert.ok(!result.ok);
      assert.match(result.error.message, new RegExp(`valid offsets are 0-${total - 1}\\b`), `total ${total}`);
    }
  });
});

describe("comboSearch — failures are structured and never thrown", () => {
  test("[CAP-02 #3] an invalid query returns Commander Spellbook's message verbatim", async () => {
    const verbatim = invalidQuery400.q![0]!;
    assert.equal(verbatim, "Invalid search query: unexpected character : at position 34.");

    const { client } = makeFakeClient(
      failure("bad_request", "Commander Spellbook rejected the request as malformed.", {
        status: 400,
        details: `q: ${verbatim}`,
      }),
    );

    const result = await comboSearch(client, { q: "nonsenseop:foo" });

    assert.ok(!result.ok);
    assert.equal(result.error.code, "bad_request");
    assert.equal(result.error.status, 400);
    assert.equal(result.error.details, `q: ${verbatim}`);
  });

  test("a network failure passes through unchanged", async () => {
    const { client } = makeFakeClient(failure("network", "Could not reach Commander Spellbook: fetch failed"));
    const result = await comboSearch(client, { q: "x" });
    assert.ok(!result.ok);
    assert.equal(result.error.code, "network");
  });

  test("a rejecting client is caught, not rethrown (MCP-PRD D-10)", async () => {
    const client: SpellbookClient = {
      get: () => Promise.reject(new Error("boom")),
      post: refusePost,
    };
    const result = await comboSearch(client, { q: "x" });
    assert.ok(!result.ok);
    assert.equal(result.error.code, "unexpected");
    assert.match(result.error.message, /boom/);
  });

  test("a success body that is not a variant envelope is reported, not crashed on", async () => {
    for (const body of [null, "a string", 42, { results: "not an array" }, {}]) {
      const { client } = makeFakeClient({ ok: true, value: body });
      const result = await comboSearch(client, { q: "x" });
      assert.ok(!result.ok, `body ${JSON.stringify(body)}`);
      assert.equal(result.error.code, "unexpected");
    }
  });
});

describe("comboSearch — format resolution happens BEFORE any upstream call", () => {
  test("[requirement 7] an unknown format is refused with zero upstream calls", async () => {
    for (const format of ["historic", "standardbrawl-typo", "notaformat", "timeless", "penny"]) {
      const { client, calls } = makeFakeClient({ ok: true, value: page1 });

      const result = await comboSearch(client, { q: "x", format });

      assert.ok(!result.ok, `format "${format}" should be refused`);
      assert.equal(result.error.code, "bad_request");
      assert.equal(calls.length, 0, `format "${format}" reached the network`);
      // The refusal names the valid set at the moment it matters — the schema deliberately does
      // not carry a 16-value enum.
      assert.match(result.error.message, /pauperCommanderMain/);
      assert.match(result.error.message, /standardBrawl/);
      assert.equal("status" in result.error, false);
    }
  });

  test("[requirement 7] `standardbrawl` is refused, `standardBrawl` is not", async () => {
    // The near-invisible trap: Scryfall's key differs from this source's only in case, so the
    // lowercase spelling must resolve rather than be refused.
    const { client, calls } = makeFakeClient({ ok: true, value: page1 });
    const result = await comboSearch(client, { q: "x", format: "standardbrawl" });

    assert.ok(result.ok);
    assert.equal(result.value.format, "standardBrawl");
    assert.equal(calls.length, 1);
  });

  test("[requirement 7] EDH and Commander both resolve and do call upstream", async () => {
    for (const format of ["EDH", "edh", "Commander", "commander"]) {
      const { client, calls } = makeFakeClient({ ok: true, value: page1 });

      const result = await comboSearch(client, { q: "x", format });

      assert.ok(result.ok, `format "${format}"`);
      assert.equal(result.value.format, "commander");
      assert.equal(calls.length, 1);
    }
  });

  test("format is never sent upstream — legality is judged from the payload", async () => {
    const { client, calls } = makeFakeClient({ ok: true, value: page1 });
    await comboSearch(client, { q: "x", format: "modern" });
    assert.deepEqual(Object.keys(calls[0]!.query!).sort(), ["count", "limit", "offset", "q"]);
  });
});

describe("comboSearch — the response states the format once", () => {
  test("[CAP-02 #14 half] one `format`, one `legal` boolean per combo, nothing else", async () => {
    const { client } = makeFakeClient({ ok: true, value: page1 });

    const result = await comboSearch(client, { q: "x", format: "vintage" });

    assert.ok(result.ok);
    assert.equal(result.value.format, "vintage");
    for (const combo of result.value.combos) assert.equal(typeof combo.legal, "boolean");

    // Matched as a JSON KEY, not as a substring: `must_be_commander` and combo descriptions both
    // contain format words in prose, and the claim being made is that no other format's legality
    // appears as a FIELD.
    const serialized = JSON.stringify(result.value);
    for (const other of ["commander", "modern", "legacy", "pauperCommanderMain", "standardBrawl"]) {
      assert.equal(serialized.includes(`"${other}":`), false, `${other} leaked as a field`);
    }
    assert.equal(serialized.includes('"legalities"'), false);
    // Exactly one statement of the format, at the top level.
    assert.equal(serialized.split('"format":').length - 1, 1);
  });

  test("the format applied is always the one requested — no applied-vs-requested gap", async () => {
    // Requirement 7 refuses anything this source cannot judge, so unlike CAP-01's
    // `legalities_mode` there is no degradation path. Nobody should add one.
    for (const format of ["modern", "legacy", "predh", "oathbreaker"]) {
      const { client } = makeFakeClient({ ok: true, value: page1 });
      const result = await comboSearch(client, { q: "x", format });
      assert.ok(result.ok);
      assert.equal(result.value.format, format);
    }
  });

  test("upstream dropping the requested legality key is reported, never read as 'not legal'", async () => {
    // §3.6: an absent key must never read as a claim. Synthesized — every real variant carries
    // all 16 — and checked once per call rather than once per combo.
    const stripped: SpellbookVariantList = {
      ...page1,
      results: page1.results.map((v) => {
        const { commander: _dropped, ...rest } = v.legalities;
        return { ...v, legalities: rest };
      }),
    };
    const { client } = makeFakeClient({ ok: true, value: stripped });

    const result = await comboSearch(client, { q: "x", format: "commander" });

    assert.ok(!result.ok);
    assert.equal(result.error.code, "unexpected");
    assert.match(result.error.message, /commander/);
  });
});

describe("comboSearch — no combo carries a bucket", () => {
  test("`bucket` belongs to combo_find_deck and never appears here", async () => {
    const { client } = makeFakeClient({ ok: true, value: page1 });

    const result = await comboSearch(client, { q: "x" });

    assert.ok(result.ok);
    for (const combo of result.value.combos) assert.equal("bucket" in combo, false);
    assert.equal(JSON.stringify(result.value).includes("bucket"), false);
  });
});
