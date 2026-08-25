import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Failure, Result } from "../../src/result.ts";
import type { SpellbookClient } from "../../src/spellbook/client.ts";
import type { SpellbookVariantList } from "../../src/spellbook/types.ts";
import { comboSearch } from "../../src/tools/combo-search.ts";

// Loaded at runtime, like every other suite here.
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
}

/** Verbatim: 40 variants, `count` 96, `next` populated. */
const page1 = fixture("spellbook/variants-page1.json") as SpellbookVariantList;
/** DERIVED: the real offset=40 response truncated to 8. `count` is still the captured 96. */
const page2 = fixture("spellbook/variants-page2.json") as SpellbookVariantList;
const empty = fixture("spellbook/variants-empty.json") as SpellbookVariantList;
/** Verbatim HTTP 400 body: `{"q":["Invalid search query: unexpected character : at position 34."]}` */
const invalidQuery400 = fixture("spellbook/variants-invalid-query-400.json") as Record<string, string[]>;

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

/** An envelope carrying `n` variants, cycling the page-1 pool and stamping distinguishable ids. */
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

describe("comboSearch — paging is a true offset", () => {
  test("[CAP-02 #8] page 1 sends limit=40, offset=0 and count=true", async () => {
    const { client, calls } = makeFakeClient({ ok: true, value: page1 });

    const result = await comboSearch(client, { q: 'card:"Thassa\'s Oracle"' });

    assert.ok(result.ok);
    assert.deepEqual(calls[0]!.query, {
      q: 'card:"Thassa\'s Oracle"',
      limit: "40",
      offset: "0",
      count: "true",
    });
    assert.equal(result.value.combos.length, 40);
    assert.equal(result.value.total_combos, 96);
    assert.equal(result.value.page, 1);
    assert.equal(result.value.has_more, true);
  });

  test("[CAP-02 #8] page 2 sends offset=40 and returns different ids", async () => {
    const { client: c1 } = makeFakeClient({ ok: true, value: page1 });
    const first = await comboSearch(c1, { q: "x" });

    const { client: c2, calls } = makeFakeClient({ ok: true, value: page2 });
    const second = await comboSearch(c2, { q: "x", page: 2 });

    assert.equal(calls[0]!.query!.offset, "40");
    assert.equal(calls[0]!.query!.limit, "40");
    assert.ok(first.ok && second.ok);

    const firstIds = new Set(first.value.combos.map((c) => c.id));
    const secondIds = second.value.combos.map((c) => c.id);
    assert.ok(secondIds.length > 0);
    for (const id of secondIds) assert.equal(firstIds.has(id), false, `id ${id} repeated on page 2`);
    assert.equal(second.value.page, 2);
  });

  test("offset arithmetic is (page - 1) * 40 — no half-page trick", async () => {
    // Slice 14's 88-card arithmetic exists because Scryfall's `page` is in units of 175 with no
    // offset. Commander Spellbook exposes a real offset, so reproducing it here would be a bug.
    for (const [page, offset] of [[1, "0"], [2, "40"], [3, "80"], [5, "160"]] as const) {
      const { client, calls } = makeFakeClient({ ok: true, value: envelope(40, { count: 500 }) });
      await comboSearch(client, { q: "x", page });
      assert.equal(calls[0]!.query!.offset, offset, `page ${page}`);
    }
  });

  test("a non-positive, fractional or absent page defends itself and becomes page 1", async () => {
    for (const page of [undefined, 0, -5, 1.7, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { client, calls } = makeFakeClient({ ok: true, value: page1 });
      const result = await comboSearch(client, {
        q: "x",
        ...(page !== undefined ? { page } : {}),
      });
      assert.ok(result.ok, `page ${String(page)}`);
      assert.equal(calls[0]!.query!.offset, "0", `page ${String(page)}`);
      assert.equal(result.value.page, 1, `page ${String(page)}`);
    }
  });

  test("[CAP-02 #8] one tool call is one upstream request — never auto-paged", async () => {
    // The scripted client rejects a second call, so an auto-page would fail loudly here.
    const { client, calls } = makeScriptedClient([{ ok: true, value: page1 }]);

    const result = await comboSearch(client, { q: "x" });

    assert.ok(result.ok);
    assert.equal(calls.length, 1);
  });

  test("has_more is false on the last page", async () => {
    // 96 combos, page 3: offset 80, 16 returned, nothing left and no `next`.
    const last = envelope(16, { count: 96, next: null });
    const { client } = makeFakeClient({ ok: true, value: last });

    const result = await comboSearch(client, { q: "x", page: 3 });

    assert.ok(result.ok);
    assert.equal(result.value.combos.length, 16);
    assert.equal(result.value.has_more, false);
    assert.equal(result.value.total_combos, 96);
  });
});

describe("comboSearch — the defensive cap", () => {
  test("[requirement 6] an envelope carrying 41 results returns 40", async () => {
    // `limit=40` is the mechanism; the slice is the guarantee. An upstream that ignores or
    // redefines `limit` must not turn into a 400,000-character tool result.
    const { client } = makeFakeClient({ ok: true, value: envelope(41, { count: 96 }) });

    const result = await comboSearch(client, { q: "x" });

    assert.ok(result.ok);
    assert.equal(result.value.combos.length, 40);
    assert.equal(result.value.has_more, true);
  });

  test("[requirement 6] an upstream that ignores limit entirely is still capped", async () => {
    const { client } = makeFakeClient({ ok: true, value: envelope(96, { count: 96, next: null }) });

    const result = await comboSearch(client, { q: "x" });

    assert.ok(result.ok);
    assert.equal(result.value.combos.length, 40);
    assert.equal(result.value.has_more, true);
    // The point of the cap: an uncapped 96-variant response is 533,840 characters upstream
    // (MCP-PRD §4.4.1). The bound asserted is the issue #25 harness ceiling, not CAP-02's 50,000
    // page budget — a live page 2 of this query measured 63,688 on 2026-08-25.
    assert.ok(JSON.stringify(result.value).length < 116_626);
  });
});

describe("comboSearch — count=true and the total", () => {
  test("[requirement 4] every outgoing request carries count=true", async () => {
    for (const params of [{ q: "x" }, { q: "x", page: 4 }, { q: "x", format: "modern" }]) {
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
    assert.equal(result.value.combos.length, 40);
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

    assert.equal(result.ok, false);
    assert.ok(!result.ok);
    assert.equal(result.error.code, "not_found");
    assert.equal(result.error.status, 404);
  });
});

describe("comboSearch — a page past the end", () => {
  test("an empty page with a non-zero total is bad_request, not an empty success", async () => {
    // Distinguishable from zero matches exactly as CAP-01 distinguishes it: `count > 0` with no
    // results is an out-of-range page, not a query that matched nothing.
    const { client } = makeFakeClient({ ok: true, value: envelope(0, { count: 96, next: null }) });

    const result = await comboSearch(client, { q: "x", page: 9 });

    assert.ok(!result.ok);
    assert.equal(result.error.code, "bad_request");
    assert.match(result.error.message, /96 combos match/);
    assert.match(result.error.message, /valid pages 1-3/);
    // No `status`: our determination from a 200 body, not an HTTP outcome.
    assert.equal("status" in result.error, false);
  });

  test("the page count is ceil(total / 40) — Slice 14's arithmetic does not transfer", async () => {
    for (const [total, pages] of [[40, 1], [41, 2], [96, 3], [176, 5], [200, 5]] as const) {
      const { client } = makeFakeClient({ ok: true, value: envelope(0, { count: total }) });
      const result = await comboSearch(client, { q: "x", page: 99 });
      assert.ok(!result.ok);
      assert.match(result.error.message, new RegExp(`valid pages 1-${pages}\\b`), `total ${total}`);
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
