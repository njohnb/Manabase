import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Failure, Result } from "../../src/result.ts";
import type { ScryfallClient } from "../../src/scryfall/client.ts";
import type { ScryfallList } from "../../src/scryfall/types.ts";
import { cardSearch } from "../../src/tools/card-search.ts";
import type { CardSummary } from "../../src/tools/card-search.ts";

// Loaded at runtime rather than imported: no `resolveJsonModule` / import attributes needed,
// and it behaves the same under type stripping and under the esbuild bundle.
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
}

const searchPage1 = fixture("search-page-1.json") as ScryfallList;
/** One real 175-card Scryfall page carrying all 23 legality keys. Serves cap, trim and bytes. */
const fullPage = fixture("search-full-page.json") as ScryfallList;
const error400 = fixture("search-error-400.json") as {
  code: string;
  status: number;
  details: string;
};

interface RecordedCall {
  path: string;
  query: Record<string, string | undefined> | undefined;
}

/** Object-literal `ScryfallClient` that records its arguments and returns a canned Result. */
function makeFakeClient(result: Result<unknown>): { client: ScryfallClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const client: ScryfallClient = {
    get(path, query) {
      calls.push({ path, query });
      return Promise.resolve(result);
    },
  };
  return { client, calls };
}

/**
 * Scripted client: the Nth `get` returns `script[N]`, so call 1 can differ from call 2 and the
 * `calls` log proves how many upstream requests a handler call made. Mirrors `makeHarness` in
 * tests/scryfall/client.test.ts, but copies the script so a shared one survives a loop.
 *
 * An unscripted call rejects rather than returning something plausible — an extra upstream
 * request is precisely the auto-paging bug the cap must not introduce.
 */
function makeScriptedClient(script: Array<Result<unknown>>): {
  client: ScryfallClient;
  calls: RecordedCall[];
} {
  const queue = [...script];
  const calls: RecordedCall[] = [];
  const client: ScryfallClient = {
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
  };
  return { client, calls };
}

/**
 * A synthetic upstream page cut from the 175-card fixture, with cards renamed `Card <n>` so a
 * test can assert *which* card landed on which page by name.
 */
function upstreamPage(
  n: number,
  opts: { total: number; hasMore: boolean; firstCard?: number },
): ScryfallList {
  const pool = fullPage.data;
  const base = opts.firstCard ?? 1;
  return {
    object: "list",
    total_cards: opts.total,
    has_more: opts.hasMore,
    data: Array.from({ length: n }, (_, i) => ({
      ...pool[i % pool.length]!,
      name: `Card ${base + i}`,
    })),
  };
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

const byName = (cards: CardSummary[], name: string): CardSummary => {
  const found = cards.find((c) => c.name === name);
  assert.ok(found, `fixture card "${name}" missing from results`);
  return found;
};

describe("cardSearch — pagination reporting", () => {
  test("[CAP-01 #9] a has_more page reports the true total and never auto-fetches", async () => {
    const { client, calls } = makeFakeClient({ ok: true, value: searchPage1 });

    const r = await cardSearch(client, { q: "t:creature" });

    assert.ok(r.ok);
    assert.equal(r.value.total_cards, 1197);
    assert.equal(r.value.has_more, true);
    assert.equal(r.value.page, 1);
    // Exactly the cards on this page — none added, none truncated.
    assert.equal(r.value.cards.length, searchPage1.data.length);
    assert.ok(r.value.note);
    assert.match(r.value.note, /1197/);
    assert.match(r.value.note, /narrow|next page|specific page/i);
    // No auto-fetch of page 2.
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.path, "/cards/search");
  });

  test("no note when has_more is false", async () => {
    const list: ScryfallList = { ...searchPage1, has_more: false, total_cards: 3 };
    const { client } = makeFakeClient({ ok: true, value: list });

    const r = await cardSearch(client, { q: "t:creature" });

    assert.ok(r.ok);
    assert.equal(r.value.has_more, false);
    assert.ok(!("note" in r.value));
  });

  test("the requested page is echoed back, not inferred", async () => {
    // A full upstream page, so page 4 is a real page rather than an overshoot.
    const { client } = makeFakeClient({ ok: true, value: fullPage });

    const r = await cardSearch(client, { q: "t:creature", page: 4 });

    assert.ok(r.ok);
    assert.equal(r.value.page, 4); // OUR page, not the upstream one it was fetched from
    assert.match(r.value.note!, /page 4/);
  });
});

describe("cardSearch — failure passthrough", () => {
  test("[CAP-01 #8] bad_request passes through with Scryfall's details verbatim", async () => {
    const canned = failure("bad_request", "Scryfall rejected the request as malformed.", {
      status: error400.status,
      details: error400.details,
    });
    const { client } = makeFakeClient(canned);

    const r = await cardSearch(client, { q: "illustrationtag:dragon" });

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "bad_request");
    assert.equal(r.error.details, "All of your terms were ignored.");
    assert.equal(r.error.details, error400.details);
    assert.equal(r.error.status, 400);
  });

  test("rate_limited, upstream_unavailable and network pass through as the same object", async () => {
    for (const code of ["rate_limited", "upstream_unavailable", "network"] as const) {
      const canned = failure(code, `synthetic ${code}`);
      const { client } = makeFakeClient(canned);

      const r = await cardSearch(client, { q: "t:goblin" });

      assert.equal(r, canned); // returned unchanged, no re-wrapping or interpretation
    }
  });
});

describe("cardSearch — zero matches", () => {
  test("not_found maps to an empty success carrying Scryfall's details as the note", async () => {
    const details = 'Your query didn\u2019t match any cards. Adjust your search terms or refer to the syntax guide at https://scryfall.com/docs/reference';
    const { client } = makeFakeClient(
      failure("not_found", "Scryfall found no match for the request.", { status: 404, details }),
    );

    const r = await cardSearch(client, { q: "t:creature t:land pow=99" });

    assert.ok(r.ok);
    assert.deepEqual(r.value.cards, []);
    assert.equal(r.value.total_cards, 0);
    assert.equal(r.value.has_more, false);
    assert.equal(r.value.page, 1);
    assert.equal(r.value.note, details);
  });

  test("not_found without details falls back to the failure message", async () => {
    const { client } = makeFakeClient(
      failure("not_found", "Scryfall found no match for the request.", { status: 404 }),
    );

    const r = await cardSearch(client, { q: "nonsense", page: 7 });

    assert.ok(r.ok);
    assert.equal(r.value.note, "Scryfall found no match for the request.");
    assert.equal(r.value.page, 7);
  });
});

describe("cardSearch — shaping", () => {
  test("scalar fields are copied and legalities carry the requested scope", async () => {
    const { client } = makeFakeClient({ ok: true, value: searchPage1 });

    // `legalities: "all"` keeps whatever the card carries, so this stays a shaping assertion
    // rather than a trim one — the trim has its own suite below.
    const r = await cardSearch(client, { q: "t:creature", legalities: "all" });
    assert.ok(r.ok);
    const strix = byName(r.value.cards, "Baleful Strix");

    assert.equal(strix.cmc, 2);
    assert.equal(strix.type_line, "Artifact Creature — Bird");
    assert.equal(strix.mana_cost, "{U}{B}");
    assert.deepEqual(strix.colors, ["B", "U"]);
    assert.deepEqual(strix.color_identity, ["B", "U"]);
    assert.equal(strix.power, "1");
    assert.equal(strix.toughness, "1");
    assert.equal(strix.rarity, "uncommon");
    assert.equal(strix.set, "2xm");
    assert.equal(strix.set_name, "Double Masters");
    assert.deepEqual(strix.legalities, searchPage1.data[0]!.legalities);
    assert.ok(!("loyalty" in strix));
  });

  test("optional fields absent on the wire are absent keys, not undefined", async () => {
    const { client } = makeFakeClient({ ok: true, value: searchPage1 });

    const r = await cardSearch(client, { q: "t:planeswalker" });
    assert.ok(r.ok);
    const jace = byName(r.value.cards, "Jace, the Mind Sculptor");

    assert.equal(jace.loyalty, "3");
    assert.ok(!("power" in jace));
    assert.ok(!("toughness" in jace));
    const entries = Object.entries(jace as unknown as Record<string, unknown>);
    assert.deepEqual(entries.filter(([, v]) => v === undefined), []);
  });

  test("a double-faced card joins both faces' oracle text with ' // '", async () => {
    const { client } = makeFakeClient({ ok: true, value: searchPage1 });

    const r = await cardSearch(client, { q: "t:creature" });
    assert.ok(r.ok);
    const delver = byName(r.value.cards, "Delver of Secrets // Insectile Aberration");

    assert.ok(delver.oracle_text);
    assert.ok(delver.oracle_text.includes(" // "));
    assert.match(delver.oracle_text, /^At the beginning of your upkeep/);
    assert.match(delver.oracle_text, /Flying$/);
    // The back face carries mana_cost "" — no dangling separator.
    assert.equal(delver.mana_cost, "{U}");
    // Top-level `colors` is absent on transform cards and is not synthesized from faces.
    assert.ok(!("colors" in delver));
  });

  test("price resolves per finish: usd -> nonfoil, usd null with usd_foil -> foil", async () => {
    const { client } = makeFakeClient({ ok: true, value: searchPage1 });

    const r = await cardSearch(client, { q: "t:creature" });
    assert.ok(r.ok);

    assert.deepEqual(byName(r.value.cards, "Baleful Strix").price, {
      available: true,
      usd: "2.47",
      finish: "nonfoil",
    });
    assert.deepEqual(byName(r.value.cards, "Delver of Secrets // Insectile Aberration").price, {
      available: true,
      usd: "12.34",
      finish: "foil",
    });
  });
});

const DEFAULT_SEVEN = [
  "standard", "pioneer", "modern", "legacy", "vintage", "commander", "pauper",
];

/** The legality keys on the first card of a successful result. */
async function keysFor(q: string, legalities?: "queried" | "default" | "all"): Promise<string[]> {
  const { client } = makeFakeClient({ ok: true, value: fullPage });
  const r = await cardSearch(client, { q, ...(legalities !== undefined ? { legalities } : {}) });
  assert.ok(r.ok);
  return Object.keys(r.value.cards[0]!.legalities);
}

describe("cardSearch — legalities trim (CAP-01 #13)", () => {
  test("a queried format returns that format's legality and no other", async () => {
    assert.deepEqual(await keysFor("t:creature f:commander"), ["commander"]);
  });

  test("a query naming no format returns exactly the seven paper defaults", async () => {
    const keys = await keysFor("t:creature cmc<=2");
    assert.deepEqual([...keys].sort(), [...DEFAULT_SEVEN].sort());
  });

  test('legalities: "all" returns all 23 keys', async () => {
    assert.equal((await keysFor("t:creature", "all")).length, 23);
  });

  test('legalities: "default" returns the seven regardless of what q names', async () => {
    const keys = await keysFor("t:creature f:modern", "default");
    assert.deepEqual([...keys].sort(), [...DEFAULT_SEVEN].sort());
  });

  test("negation still names a format — the user cares about it either way", async () => {
    assert.deepEqual(await keysFor("-f:modern t:goblin"), ["modern"]);
  });

  test("multiple formats union", async () => {
    assert.deepEqual([...(await keysFor("f:modern or f:legacy"))].sort(), ["legacy", "modern"]);
  });

  test("the scan is case-insensitive", async () => {
    assert.deepEqual(await keysFor("F:Commander"), ["commander"]);
  });

  test("format:, legal:, banned: and restricted: all name a format", async () => {
    // All five operators verified live 2026-08-10; `format:` and `legal:` filter exactly as `f:`.
    assert.deepEqual(await keysFor("format:vintage"), ["vintage"]);
    assert.deepEqual(await keysFor("legal:pauper"), ["pauper"]);
    assert.deepEqual([...(await keysFor("banned:modern restricted:vintage"))].sort(), [
      "modern",
      "vintage",
    ]);
  });

  test("an operator embedded in a word is not a format term", async () => {
    const keys = await keysFor("otag:removal o:legalize t:legendary");
    assert.deepEqual([...keys].sort(), [...DEFAULT_SEVEN].sort());
  });
});

describe("cardSearch — the trim never empties the map (requirement 5)", () => {
  // A bogus format and a real Scryfall alias both scan to zero legality keys. Trimming to an
  // empty map would read as "this card has no legalities" — a normal-looking wrong answer of the
  // same class as the `\A` trap. Both must degrade to the default set.
  for (const q of ["f:notaformat", "f:edh"]) {
    test(`${q} falls back to the seven defaults, never an empty map`, async () => {
      const keys = await keysFor(q);
      assert.notEqual(keys.length, 0);
      assert.deepEqual([...keys].sort(), [...DEFAULT_SEVEN].sort());
    });
  }

  test("a partially valid scan keeps the valid format", async () => {
    assert.deepEqual(await keysFor("f:commander f:edh"), ["commander"]);
  });
});

describe("cardSearch — page cap and paging (CAP-01 #14)", () => {
  test("[#4] 111 cards: page 1 caps at 88 with has_more true though upstream says false", async () => {
    const page111 = upstreamPage(111, { total: 111, hasMore: false });
    const { client, calls } = makeScriptedClient([
      { ok: true, value: page111 },
      { ok: true, value: page111 },
    ]);

    const p1 = await cardSearch(client, { q: "t:legendary f:commander" });
    const p2 = await cardSearch(client, { q: "t:legendary f:commander", page: 2 });

    assert.ok(p1.ok && p2.ok);
    assert.equal(p1.value.cards.length, 88);
    assert.equal(p1.value.total_cards, 111); // Scryfall's true total, untouched by the cap
    assert.equal(p1.value.has_more, true); // ours — 23 cards remain in the page we hold
    assert.equal(p2.value.cards.length, 23);
    assert.equal(p2.value.has_more, false);
    // Card 89 is reachable, on page 2. No card is reachable by no page.
    assert.equal(p2.value.cards[0]!.name, "Card 89");
    // One upstream request per call, and our page 2 came from UPSTREAM page 1.
    assert.equal(calls.length, 2);
    assert.equal(calls[0]!.query!.page, "1");
    assert.equal(calls[1]!.query!.page, "1");
  });

  test("[#5] a 175-card page splits 88/87, one upstream request each", async () => {
    const page175 = upstreamPage(175, { total: 1203, hasMore: true });
    const { client, calls } = makeScriptedClient([
      { ok: true, value: page175 },
      { ok: true, value: page175 },
    ]);

    const p1 = await cardSearch(client, { q: "t:creature f:modern" });
    const p2 = await cardSearch(client, { q: "t:creature f:modern", page: 2 });

    assert.ok(p1.ok && p2.ok);
    assert.equal(p1.value.cards.length, 88);
    assert.equal(p2.value.cards.length, 87); // the halves are 88 and 87; the unevenness is fine
    assert.equal(p2.value.cards[0]!.name, "Card 89");
    assert.equal(calls.length, 2);
    assert.equal(calls[0]!.query!.page, "1");
    assert.equal(calls[1]!.query!.page, "1");
  });

  test("our page 3 is the first half of upstream page 2", async () => {
    const { client, calls } = makeScriptedClient([
      { ok: true, value: upstreamPage(175, { total: 1203, hasMore: true, firstCard: 176 }) },
    ]);

    const r = await cardSearch(client, { q: "t:creature f:modern", page: 3 });

    assert.ok(r.ok);
    assert.equal(calls[0]!.query!.page, "2");
    assert.equal(r.value.cards.length, 88);
    assert.equal(r.value.cards[0]!.name, "Card 176");
    // Not "cards 177-264": the second half of an upstream page holds 87, so a naive
    // (page-1)*88+1 drifts one card per upstream page.
    assert.match(r.value.note!, /cards 176-263 \(page 3 of 14\)/);
  });

  test("[#6] total_cards 176 reports 3 pages, not ceil(176/88) = 2", async () => {
    const { client } = makeScriptedClient([
      { ok: true, value: upstreamPage(175, { total: 176, hasMore: true }) },
    ]);

    const r = await cardSearch(client, { q: "t:creature f:modern" });

    assert.ok(r.ok);
    assert.match(r.value.note!, /page 1 of 3/);
  });

  test("the last page still reports its position even though has_more is false", async () => {
    const { client } = makeScriptedClient([
      { ok: true, value: upstreamPage(1, { total: 176, hasMore: false, firstCard: 176 }) },
    ]);

    const r = await cardSearch(client, { q: "t:creature f:modern", page: 3 });

    assert.ok(r.ok);
    assert.equal(r.value.has_more, false);
    assert.match(r.value.note!, /cards 176-176 \(page 3 of 3\)/);
  });

  test("a single-page result carries no note", async () => {
    const { client } = makeScriptedClient([
      { ok: true, value: upstreamPage(88, { total: 88, hasMore: false }) },
    ]);

    const r = await cardSearch(client, { q: "t:creature f:modern" });

    assert.ok(r.ok);
    assert.equal(r.value.cards.length, 88);
    assert.equal(r.value.has_more, false);
    assert.ok(!("note" in r.value));
  });
});

describe("cardSearch — a page past the end is not zero matches (requirement 10)", () => {
  test("[#7] overshooting inside a page we hold names the valid range", async () => {
    const { client, calls } = makeScriptedClient([
      { ok: true, value: upstreamPage(50, { total: 50, hasMore: false }) },
    ]);

    const r = await cardSearch(client, { q: "t:creature f:modern", page: 2 });

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "bad_request");
    assert.match(r.error.message, /past the end/i);
    assert.match(r.error.message, /valid pages 1-1/);
    // The distinguishing fact: 50 cards matched. This is not "no cards match".
    assert.match(r.error.message, /50 cards match/);
    assert.match(r.error.message, /not a query that matched nothing/i);
    assert.equal(calls.length, 1); // still one upstream request
  });

  test("overshooting past the last upstream page is a client error, not `unexpected`", async () => {
    // Scryfall answers a page beyond its last with HTTP 422 (verified live 2026-08-10), which the
    // client maps to `unexpected` — a code that reads as a server fault.
    const { client } = makeScriptedClient([
      failure("unexpected", "Scryfall returned an unexpected status 422.", {
        status: 422,
        details: "You have paginated beyond the end of these results.",
      }),
    ]);

    const r = await cardSearch(client, { q: "t:creature f:modern", page: 5 });

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "bad_request");
    assert.equal(r.error.status, 422);
    assert.match(r.error.message, /Page 5 is past the end/);
    assert.equal(r.error.details, "You have paginated beyond the end of these results.");
  });

  test("zero matches stays a successful empty result with total_cards 0", async () => {
    const { client } = makeScriptedClient([
      failure("not_found", "Scryfall found no match.", { details: "Your query didn't match." }),
    ]);

    const r = await cardSearch(client, { q: "t:creature f:modern", page: 2 });

    // The 404 mapping wins over the out-of-range path, and `total_cards: 0` is what tells the
    // two apart.
    assert.ok(r.ok);
    assert.equal(r.value.total_cards, 0);
    assert.deepEqual(r.value.cards, []);
    assert.equal(r.value.note, "Your query didn't match.");
  });

  test("a page below 1 is clamped rather than producing a negative slice", async () => {
    // Unclamped, JS (-1) % 2 === -1 gives offset -88: page 0 slices empty and page -5 would
    // serve page 1's cards under a nonsense label.
    for (const page of [0, -5, 1.7, Number.NaN]) {
      const { client, calls } = makeScriptedClient([
        { ok: true, value: upstreamPage(175, { total: 1203, hasMore: true }) },
      ]);
      const r = await cardSearch(client, { q: "t:creature f:modern", page });
      assert.ok(r.ok, `page ${page} should not fail`);
      assert.ok(r.value.page >= 1, `page ${page} echoed ${r.value.page}`);
      assert.ok(r.value.cards.length > 0, `page ${page} returned no cards`);
      assert.ok(Number.isInteger(Number(calls[0]!.query!.page)));
    }
  });
});

describe("cardSearch — scope reporting (requirement 6)", () => {
  test("both fields are present under all three modes", async () => {
    for (const mode of ["queried", "default", "all"] as const) {
      const { client } = makeFakeClient({ ok: true, value: fullPage });
      const r = await cardSearch(client, { q: "t:creature f:commander", legalities: mode });
      assert.ok(r.ok);
      assert.equal(typeof r.value.legalities_mode, "string");
      assert.ok(Array.isArray(r.value.legalities_included));
      // The reported keys are exactly the keys actually on the cards — never a claim about a
      // format that was not returned.
      assert.deepEqual(
        [...r.value.legalities_included].sort(),
        Object.keys(r.value.cards[0]!.legalities).sort(),
      );
    }
  });

  test("mode describes the payload, so a scan miss reports `default`", async () => {
    const { client } = makeFakeClient({ ok: true, value: fullPage });
    const r = await cardSearch(client, { q: "f:edh" });
    assert.ok(r.ok);
    assert.equal(r.value.legalities_mode, "default");
    assert.deepEqual([...r.value.legalities_included].sort(), [...DEFAULT_SEVEN].sort());
  });

  test("both fields are present on a zero-match result too", async () => {
    const { client } = makeScriptedClient([failure("not_found", "no match")]);
    const r = await cardSearch(client, { q: "t:creature f:commander" });
    assert.ok(r.ok);
    assert.equal(r.value.legalities_mode, "queried");
    assert.deepEqual(r.value.legalities_included, ["commander"]);
  });
});

describe("cardSearch — payload size (issue #25)", () => {
  test("a shaped page is far smaller than the 169,504-char untrimmed full page", async () => {
    const { client } = makeFakeClient({ ok: true, value: fullPage });

    const r = await cardSearch(client, { q: "t:creature f:commander" });

    assert.ok(r.ok);
    const chars = JSON.stringify(r.value).length;
    // A bound, not an equality: per-card cost varies with the cards a query returns, so an exact
    // figure would fail on a fixture refresh for no real reason.
    assert.ok(chars < 60_000, `expected well under 60,000 chars, got ${chars}`);
    assert.equal(r.value.cards.length, 88);
  });

  test("issue #25's own shape lands far below the 116,626 that breached the ceiling", async () => {
    const { client } = makeScriptedClient([
      { ok: true, value: upstreamPage(111, { total: 111, hasMore: false }) },
    ]);

    const r = await cardSearch(client, {
      q: "t:legendary t:creature id=rg is:commander f:commander",
    });

    assert.ok(r.ok);
    assert.ok(
      JSON.stringify(r.value).length < 116_626,
      "the shaped result must be smaller than the payload that failed",
    );
  });
});

describe("cardSearch — request parameters", () => {
  test("defaults: unique=cards, page=1, order/dir omitted", async () => {
    const { client, calls } = makeFakeClient({ ok: true, value: searchPage1 });

    await cardSearch(client, { q: "o:/^{T}: Add/ t:land" });

    assert.equal(calls.length, 1);
    const query = calls[0]!.query!;
    assert.equal(query.q, "o:/^{T}: Add/ t:land"); // verbatim passthrough, no rewriting
    assert.equal(query.unique, "cards");
    assert.equal(query.page, "1");
    assert.equal(query.order, undefined);
    assert.equal(query.dir, undefined);
  });

  test("explicit unique/order/dir/page are passed through", async () => {
    const { client, calls } = makeFakeClient({ ok: true, value: searchPage1 });

    await cardSearch(client, {
      q: "t:dragon",
      unique: "prints",
      order: "cmc",
      dir: "desc",
      page: 3,
    });

    assert.deepEqual(calls[0]!.query, {
      q: "t:dragon",
      unique: "prints",
      order: "cmc",
      dir: "desc",
      // Our page 3 is the first half of UPSTREAM page 2 — the page number is translated, and
      // `q` is still sent verbatim.
      page: "2",
    });
  });
});
