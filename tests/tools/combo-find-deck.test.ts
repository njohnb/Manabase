import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Result } from "../../src/result.ts";
import type { HttpClient } from "../../src/http/client.ts";
import type { Clients } from "../../src/tools/register.ts";
import { comboFindDeck } from "../../src/tools/combo-find-deck.ts";
import type { ComboFindDeckData } from "../../src/tools/combo-find-deck.ts";

// Loaded at runtime, like every other suite here.
function fixtureText(name: string): string {
  return readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");
}
function fixture(name: string): unknown {
  return JSON.parse(fixtureText(name));
}

/**
 * DERIVED (see tests/fixtures/spellbook/README.md): the real capture held 164 variants across the
 * six buckets and was truncated to 14 — all 8 `included`, the first 4 of 106 `almostIncluded`, the
 * first 1 of 49 `almostIncludedByAddingColors`, and the 1 `almostIncludedByChangingCommanders`.
 * `count` was changed from 164 to 14 to match. `results.identity` is `"UBR"`, as captured.
 *
 * Cite MCP-PRD §4.4.1's measurements from the PRD; never recompute them from this file.
 */
const deckFixture = fixture("spellbook/find-my-combos-deck.json") as DeckPayload;
const deckFixtureText = fixtureText("spellbook/find-my-combos-deck.json");

/** VERBATIM: the same deck at `limit=5` — four matched and one near, which is criterion 5's point. */
const limit5Fixture = fixture("spellbook/find-my-combos-limit5.json");

/** VERBATIM: three cards, one of them invented. Upstream reports the invention nowhere. */
const bogusNameFixture = fixture("spellbook/find-my-combos-bogus-name.json");

/** VERBATIM Scryfall `POST /cards/collection`: `not_found: [{"name":"Zzzz Not A Real Card 9999"}]`. */
const collectionNotFound = fixture("collection-not-found.json");

/** Mirrors BYTE_BUDGET in src/spellbook/combos.ts. */
const BYTE_BUDGET = 50_000;

interface DeckPayload {
  count: number | null;
  next: string | null;
  previous: string | null;
  results: Record<string, unknown>;
}

interface PostedCall {
  path: string;
  body: unknown;
  query: Record<string, string | undefined> | undefined;
}

const refuseGet = (path: string): Promise<never> =>
  Promise.reject(new Error(`fake client: comboFindDeck must not GET (${path})`));

/**
 * One source, with a per-call reply function and its own log.
 *
 * Returning `undefined` from `reply` REJECTS, keeping combo-search.test.ts's rule that an
 * unscripted call fails loudly. Half the criteria here are assertions about WHICH source was
 * called and HOW MANY times, and a lenient fake makes every one of them vacuous.
 */
function fakeSource(reply: (body: unknown, callIndex: number) => Result<unknown> | undefined): {
  client: HttpClient;
  posts: PostedCall[];
} {
  const posts: PostedCall[] = [];
  const client: HttpClient = {
    get: refuseGet,
    post(path, body, query) {
      const index = posts.length;
      posts.push({ path, body, query });
      const result = reply(body, index);
      if (result === undefined) {
        return Promise.reject(new Error(`scripted client: no reply for call ${index} to ${path}`));
      }
      return Promise.resolve(result);
    },
  };
  return { client, posts };
}

/** Every submitted identifier comes back found. The ordinary case: a decklist with no typos. */
const echoAllFound = (body: unknown): Result<unknown> => ({
  ok: true,
  value: {
    object: "list",
    not_found: [],
    data: (body as { identifiers: Array<{ name: string }> }).identifiers.map(({ name }) => ({ name })),
  },
});

const canned = (value: unknown) => (): Result<unknown> => ({ ok: true, value });

/** Two sources with INDEPENDENT scripts and INDEPENDENT logs. */
function makeBundle(
  scryfallReply: (body: unknown, i: number) => Result<unknown> | undefined,
  spellbookReply: (body: unknown, i: number) => Result<unknown> | undefined,
): { clients: Clients; scryfallPosts: PostedCall[]; spellbookPosts: PostedCall[] } {
  const scryfall = fakeSource(scryfallReply);
  const spellbook = fakeSource(spellbookReply);
  return {
    clients: { scryfall: scryfall.client, spellbook: spellbook.client },
    scryfallPosts: scryfall.posts,
    spellbookPosts: spellbook.posts,
  };
}

/** The ordinary bundle: every name resolves, and upstream returns the derived deck fixture. */
const deckBundle = (payload: unknown = deckFixture) => makeBundle(echoAllFound, canned(payload));

const DECK = ["Demonic Consultation", "Thassa's Oracle"];

const bucketOf = (data: ComboFindDeckData, id: string): string | undefined =>
  data.combos.find((combo) => combo.id === id)?.bucket;

const unwrap = (result: Result<ComboFindDeckData>): ComboFindDeckData => {
  assert.equal(result.ok, true, result.ok ? "" : `unexpected failure: ${result.error.message}`);
  if (!result.ok) throw new Error("unreachable");
  return result.value;
};

/**
 * Repeat a fixture variant under distinct ids. SYNTHESIZED — derived data, exactly like the
 * truncated fixture it is built from — because no committed fixture holds enough combos in one
 * bucket to make the byte budget bite.
 */
function repeat(variant: unknown, n: number, prefix: string, describeChars = 0): unknown[] {
  return Array.from({ length: n }, (_, i) => ({
    ...(variant as Record<string, unknown>),
    id: `${prefix}-${i + 1}`,
    ...(describeChars > 0 ? { description: "x".repeat(describeChars) } : {}),
  }));
}

/** A six-bucket envelope with only the named buckets populated. */
function deckPayload(buckets: Record<string, unknown>, envelope: Partial<DeckPayload> = {}): unknown {
  return {
    count: null,
    next: null,
    previous: null,
    ...envelope,
    results: {
      identity: "UBR",
      included: [],
      includedByChangingCommanders: [],
      almostIncluded: [],
      almostIncludedByAddingColors: [],
      almostIncludedByChangingCommanders: [],
      almostIncludedByAddingColorsAndChangingCommanders: [],
      ...buckets,
    },
  };
}

const includedVariant = (deckFixture.results.included as unknown[])[0];
const nearVariant = (deckFixture.results.almostIncluded as unknown[])[0];

describe("comboFindDeck — the combo the tool exists to find", () => {
  test("[CAP-02 #4] Demonic Consultation + Thassa's Oracle comes back as one the deck CONTAINS", async () => {
    const { clients } = deckBundle();

    const data = unwrap(await comboFindDeck(clients, { cards: DECK }));

    const combo = data.combos.find((c) => c.id === "742-1295");
    assert.ok(combo, "the two-card win condition is missing from the result");
    assert.deepEqual(
      combo.uses.map((use) => use.name).sort(),
      ["Demonic Consultation", "Thassa's Oracle"],
    );
    // Labelled, not merely present: a near-miss must never be presentable as a combo the deck has.
    assert.equal(combo.bucket, "included");
  });

  test("[CAP-02 #1] the handler is a plain function — no server, no transport", async () => {
    // The whole suite is this assertion; it is stated once so the criterion has a home.
    const { clients } = deckBundle();
    const result = await comboFindDeck(clients, { cards: DECK });
    assert.equal(result.ok, true);
  });
});

describe("comboFindDeck — classification across the six buckets", () => {
  test("[requirement 6] all six bucket names round-trip VERBATIM", async () => {
    // `includedByChangingCommanders` and `almostIncludedByChangingCommanders` differ by one word
    // and mean opposite things. A translation layer here produces a correctly-shaped,
    // WRONGLY-LABELLED result — the failure MCP-PRD §4.4 rejects local deck matching for.
    const buckets = [
      "included",
      "includedByChangingCommanders",
      "almostIncluded",
      "almostIncludedByAddingColors",
      "almostIncludedByChangingCommanders",
      "almostIncludedByAddingColorsAndChangingCommanders",
    ];
    const payload = deckPayload(
      Object.fromEntries(buckets.map((name) => [name, repeat(includedVariant, 1, name)])),
    );
    const { clients } = deckBundle(payload);

    const data = unwrap(await comboFindDeck(clients, { cards: DECK, include: "matched+near" }));

    assert.equal(data.total_combos, 6);
    for (const name of buckets) {
      assert.equal(bucketOf(data, `${name}-1`), name, name);
    }
  });

  test("[requirement 6] an unknown SEVENTH bucket is ignored, not crashed on or guessed at", async () => {
    const payload = deckPayload({
      included: repeat(includedVariant, 1, "real"),
      almostIncludedBySomeFutureRule: repeat(includedVariant, 3, "future"),
    });
    const { clients } = deckBundle(payload);

    const data = unwrap(await comboFindDeck(clients, { cards: DECK, include: "matched+near" }));

    assert.equal(data.total_combos, 1);
    assert.deepEqual(data.combos.map((c) => c.id), ["real-1"]);
  });

  test("a bucket upstream stops sending is skipped rather than throwing", async () => {
    // Typed as an array, but the value crosses the wire behind a cast.
    const payload = { count: null, next: null, previous: null, results: { identity: "UB" } };
    const { clients } = deckBundle(payload);

    const data = unwrap(await comboFindDeck(clients, { cards: DECK, include: "matched+near" }));

    assert.equal(data.total_combos, 0);
    assert.deepEqual(data.combos, []);
  });

  test("[requirement 13] color_identity reads results.identity, INSIDE results", async () => {
    // Reading the envelope top level produces `undefined` rather than an error, which is exactly
    // the kind of wrong answer that does not announce itself.
    const { clients } = deckBundle();

    const data = unwrap(await comboFindDeck(clients, { cards: DECK }));

    assert.equal(data.color_identity, "UBR");
    assert.notEqual(data.color_identity, undefined);
  });

  test("a results object with no string identity is a structured unexpected, not undefined", async () => {
    const payload = { count: null, next: null, previous: null, results: { included: [] } };
    const { clients } = deckBundle(payload);

    const result = await comboFindDeck(clients, { cards: DECK });

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, "unexpected");
  });

  test("a /variants/-shaped body (results as an ARRAY) is refused", async () => {
    const { clients } = deckBundle({ count: 1, next: null, previous: null, results: [] });

    const result = await comboFindDeck(clients, { cards: DECK });

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, "unexpected");
  });
});

describe("comboFindDeck — the near-miss opt-in", () => {
  test("[CAP-02 #9] include defaults to matched and NO near-miss appears", async () => {
    const { clients } = deckBundle();

    const data = unwrap(await comboFindDeck(clients, { cards: DECK }));

    assert.equal(data.include, "matched");
    assert.equal(data.total_combos, 8); // the fixture's eight `included`, and nothing else
    for (const combo of data.combos) {
      assert.ok(
        combo.bucket === "included" || combo.bucket === "includedByChangingCommanders",
        `near-miss ${combo.id} leaked into a matched-only response as ${combo.bucket}`,
      );
    }
    // Not just absent from the shaped combos — absent from the serialized response entirely.
    assert.equal(JSON.stringify(data).includes("almostIncluded"), false);
  });

  test('[CAP-02 #9] an explicit "matched" behaves identically to the default', async () => {
    const { clients } = deckBundle();

    const data = unwrap(await comboFindDeck(clients, { cards: DECK, include: "matched" }));

    assert.equal(data.include, "matched");
    assert.equal(data.total_combos, 8);
  });

  test('[CAP-02 #9] "matched+near" returns near-misses, each labelled with its own bucket', async () => {
    const { clients } = deckBundle();

    const data = unwrap(await comboFindDeck(clients, { cards: DECK, include: "matched+near" }));

    assert.equal(data.include, "matched+near");
    assert.equal(data.total_combos, 14); // 8 + 4 + 1 + 1
    // Asserted against ALL FOUR near buckets the fixture carries, not just `almostIncluded`.
    assert.equal(bucketOf(data, "513-5034--46"), "almostIncluded");
    assert.equal(bucketOf(data, "1368-2706-4682"), "almostIncludedByAddingColors");
    assert.equal(bucketOf(data, "3591-4567"), "almostIncludedByChangingCommanders");
    assert.equal(bucketOf(data, "742-1295"), "included");
  });

  test("a wrong-typed include falls back to the default rather than failing the call", async () => {
    const { clients } = deckBundle();

    const data = unwrap(
      await comboFindDeck(clients, { cards: DECK, include: "near" as "matched" }),
    );

    assert.equal(data.include, "matched");
    assert.equal(data.total_combos, 8);
  });
});

describe("comboFindDeck — the cap is never pushed upstream", () => {
  test("[CAP-02 #10] the outgoing POST carries no limit and no offset", async () => {
    const { clients, spellbookPosts } = deckBundle();

    await comboFindDeck(clients, { cards: DECK });

    assert.equal(spellbookPosts.length, 1);
    assert.equal(spellbookPosts[0]!.path, "/find-my-combos");
    // No query string at all — not `limit: undefined`, which would also pass a weaker assertion.
    assert.equal(spellbookPosts[0]!.query, undefined);
  });

  test("[CAP-02 #10] a NON-ZERO offset is still not passed upstream", async () => {
    // The regression a "pass it through like combo_search" edit would introduce. Upstream `offset`
    // walks a list whose first entries are not the deck's own combos, so this is not a smaller
    // correct answer — it is a wrong answer that looks right.
    const { clients, spellbookPosts } = deckBundle();

    await comboFindDeck(clients, { cards: DECK, offset: 3, include: "matched+near" });

    assert.equal(spellbookPosts[0]!.query, undefined);
    assert.equal(JSON.stringify(spellbookPosts[0]!.body).includes("offset"), false);
    assert.equal(JSON.stringify(spellbookPosts[0]!.body).includes("limit"), false);
  });

  test("[CAP-02 #10] against the limit=5 capture, ALL matched combos are returned", async () => {
    // The verbatim capture at `limit=5`: four `included` and one `almostIncluded`, while the full
    // result's first eight flattened entries are all `included` (MCP-PRD §4.4, verified
    // 2026-08-24). A capped upstream request drops the combos the deck actually has.
    const { clients } = deckBundle(limit5Fixture);

    const data = unwrap(await comboFindDeck(clients, { cards: DECK }));

    assert.equal(data.total_combos, 4);
    assert.deepEqual(
      data.combos.map((c) => c.id),
      ["742-1295", "1295-3093", "1368-1414-4856", "4821-5261"],
    );
    for (const combo of data.combos) assert.equal(combo.bucket, "included");
  });

  test("upstream paginating a request that asked for no page is REPORTED", async () => {
    // Never observed — the 164-variant capture came back whole with `next: null` — but the limit=5
    // capture carries a real `next`, so the guard has a live example to fire on.
    const { clients } = deckBundle(limit5Fixture);

    const data = unwrap(await comboFindDeck(clients, { cards: DECK }));

    assert.match(data.note ?? "", /may be incomplete/);
  });

  test("one tool call is one upstream combo request — never auto-paged", async () => {
    const { clients, spellbookPosts } = makeBundle(echoAllFound, (_body, i) =>
      i === 0 ? { ok: true, value: deckFixture } : undefined,
    );

    unwrap(await comboFindDeck(clients, { cards: DECK, include: "matched+near" }));

    assert.equal(spellbookPosts.length, 1);
  });
});

describe("comboFindDeck — unresolved names are the guard", () => {
  test("[CAP-02 #5] an invented name is reported, the real cards still resolve, combos still return", async () => {
    const { clients } = makeBundle(canned(collectionNotFound), canned(bogusNameFixture));

    const data = unwrap(
      await comboFindDeck(clients, {
        cards: ["Demonic Consultation", "Thassa's Oracle", "Zzzz Not A Real Card 9999"],
      }),
    );

    assert.deepEqual(data.unresolved_cards, ["Zzzz Not A Real Card 9999"]);
    assert.equal(data.total_combos, 1);
    assert.equal(data.combos[0]!.id, "742-1295");
  });

  test("[requirement 3] the unresolved name is still sent upstream, as submitted", async () => {
    // Dropping it would change the deck the user asked about, silently, on our own initiative —
    // and Commander Spellbook matching Scryfall's canonical names is INFERRED, not verified.
    const { clients, spellbookPosts } = makeBundle(canned(collectionNotFound), canned(bogusNameFixture));

    await comboFindDeck(clients, {
      cards: ["Demonic Consultation", "Thassa's Oracle", "Zzzz Not A Real Card 9999"],
    });

    assert.deepEqual(spellbookPosts[0]!.body, {
      main: [
        { card: "Demonic Consultation", quantity: 1 },
        { card: "Thassa's Oracle", quantity: 1 },
        { card: "Zzzz Not A Real Card 9999", quantity: 1 },
      ],
      commanders: [],
    });
  });

  test("[requirement 2] unresolved_cards is present and [] on a decklist with no typos", async () => {
    // An absent key would let "we checked and found no typos" and "we did not check" read
    // identically, which MCP-PRD §3.6 forbids.
    const { clients } = deckBundle();

    const data = unwrap(await comboFindDeck(clients, { cards: DECK }));

    assert.deepEqual(data.unresolved_cards, []);
    assert.equal("unresolved_cards" in data, true);
    assert.equal(JSON.stringify(data).includes('"unresolved_cards":[]'), true);
  });

  test("[requirement 1] commanders are resolved too, in the same batch stream", async () => {
    const { clients, scryfallPosts } = deckBundle();

    await comboFindDeck(clients, { cards: DECK, commanders: ["Thrasios, Triton Hero"] });

    assert.equal(scryfallPosts.length, 1);
    assert.deepEqual(
      (scryfallPosts[0]!.body as { identifiers: Array<{ name: string }> }).identifiers.map((i) => i.name),
      [...DECK, "Thrasios, Triton Hero"],
    );
  });

  test("[Slice 17 #10] a 100-name deck is 2 Scryfall requests, 75 is 1, 76 is 2", async () => {
    for (const [count, expected] of [[75, 1], [76, 2], [100, 2]] as Array<[number, number]>) {
      const { clients, scryfallPosts } = deckBundle();

      await comboFindDeck(clients, {
        cards: Array.from({ length: count }, (_, i) => `Card ${i + 1}`),
      });

      assert.equal(scryfallPosts.length, expected, `${count} names`);
    }
  });

  test("[requirement 4] a failing Scryfall batch returns that Failure and makes NO combo call", async () => {
    const failure: Result<unknown> = {
      ok: false,
      error: { code: "upstream_unavailable", message: "Scryfall is currently unavailable.", status: 503 },
    };
    // The spellbook fake replies to nothing: if the handler called it, the test rejects.
    const { clients, spellbookPosts } = makeBundle(() => failure, () => undefined);

    const result = await comboFindDeck(clients, { cards: DECK });

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, "upstream_unavailable");
    assert.equal(!result.ok && result.error.status, 503);
    assert.equal(spellbookPosts.length, 0);
  });
});

describe("comboFindDeck — the byte budget and offset paging", () => {
  test("[CAP-02 #8] a page never exceeds the budget once more than one combo fits", async () => {
    const payload = deckPayload({ included: repeat(includedVariant, 60, "costly", 5_000) });
    const { clients } = deckBundle(payload);

    const data = unwrap(await comboFindDeck(clients, { cards: DECK }));

    assert.ok(JSON.stringify(data).length <= BYTE_BUDGET, "page exceeded the budget");
    assert.ok(data.combos.length > 1);
    assert.ok(data.combos.length < 60, "the budget did not bite");
    assert.equal(data.has_more, true);
    assert.equal(data.total_combos, 60);
  });

  test("[CAP-02 #8] a cheap deck fits one page, with no next_offset", async () => {
    const { clients } = deckBundle();

    const data = unwrap(await comboFindDeck(clients, { cards: DECK, include: "matched+near" }));

    assert.equal(data.combos.length, 14);
    assert.equal(data.total_combos, 14);
    assert.equal(data.has_more, false);
    assert.equal("next_offset" in data, false);
  });

  test("[CAP-02 #8] total_combos counts AFTER classification, not upstream's count", async () => {
    // The fixture's `count` is 14 and its six buckets hold 14 — but under the default
    // `include: "matched"` only 8 of them are the answer to the question asked.
    assert.equal(deckFixture.count, 14);
    const { clients } = deckBundle();

    const data = unwrap(await comboFindDeck(clients, { cards: DECK }));

    assert.equal(data.total_combos, 8);
  });

  test("[CAP-02 #8] following next_offset reaches every combo exactly once", async () => {
    const payload = deckPayload({ included: repeat(includedVariant, 45, "costly", 4_000) });
    const seen: string[] = [];
    let offset = 0;

    for (let guard = 0; guard < 20; guard += 1) {
      const { clients } = deckBundle(payload);
      const data = unwrap(await comboFindDeck(clients, { cards: DECK, offset }));

      assert.equal(data.offset, offset);
      seen.push(...data.combos.map((c) => c.id));
      if (!data.has_more) break;
      assert.ok(data.next_offset! > offset, "offset must strictly advance");
      offset = data.next_offset!;
    }

    assert.equal(seen.length, 45);
    assert.equal(new Set(seen).size, 45);
  });

  test("[requirement 9] one combo larger than the WHOLE budget is still returned", async () => {
    // Returning zero would leave `next_offset` equal to `offset` and the caller would page forever.
    // An oversized response is a bad page; a non-advancing offset is an infinite loop.
    const payload = deckPayload({ included: repeat(includedVariant, 3, "huge", BYTE_BUDGET * 2) });
    const { clients } = deckBundle(payload);

    const data = unwrap(await comboFindDeck(clients, { cards: DECK }));

    assert.equal(data.combos.length, 1);
    assert.equal(data.next_offset, 1, "next_offset must advance past an oversized combo");
    assert.equal(data.has_more, true);
    assert.ok(JSON.stringify(data).length > BYTE_BUDGET);
  });

  test("[requirement 9] unresolved_cards is reserved against the budget", async () => {
    // `unresolved_cards` scales with the input, so the flat envelope allowance cannot cover it. A
    // deck of 300 unrecognized names costs thousands of characters before a single combo is shaped.
    const typos = Array.from({ length: 300 }, (_, i) => `Zzzz Not A Real Card ${i + 1}`);
    const payload = deckPayload({ included: repeat(includedVariant, 60, "costly", 3_000) });
    const { clients } = makeBundle(
      (body) => ({
        ok: true,
        value: {
          object: "list",
          not_found: (body as { identifiers: Array<{ name: string }> }).identifiers,
          data: [],
        },
      }),
      canned(payload),
    );

    const data = unwrap(await comboFindDeck(clients, { cards: typos }));

    assert.equal(data.unresolved_cards.length, 300);
    assert.ok(
      JSON.stringify(data).length <= BYTE_BUDGET,
      `page was ${JSON.stringify(data).length} characters`,
    );
  });

  test("[requirement 8] a matched combo is never displaced by a near-miss", async () => {
    // Matched-first ordering delivers this absolutely. What it does NOT promise is that every
    // matched combo fits page 1: if the matched combos alone exceed the budget, later ones land on
    // page 2 — correct behaviour, since every one is reachable by following `next_offset`.
    const payload = deckPayload({
      included: repeat(includedVariant, 30, "matched", 3_000),
      almostIncluded: repeat(nearVariant, 30, "near", 3_000),
    });

    const { clients } = deckBundle(payload);
    const page1 = unwrap(await comboFindDeck(clients, { cards: DECK, include: "matched+near" }));

    assert.equal(page1.total_combos, 60);
    assert.ok(page1.has_more, "the synthesized payload must exceed one page for this to mean anything");
    // Ordering: no near-miss before a matched combo, anywhere in the flattened order.
    const firstNear = page1.combos.findIndex((c) => c.bucket !== "included");
    if (firstNear !== -1) {
      for (const combo of page1.combos.slice(firstNear)) {
        assert.notEqual(combo.bucket, "included", "a matched combo appeared after a near-miss");
      }
    }
    assert.ok(page1.combos.length < 30, "page 1 must be short enough to displace a matched combo");

    // Reachability: the matched combos pushed past the budget are on the next page.
    const { clients: clients2 } = deckBundle(payload);
    const page2 = unwrap(
      await comboFindDeck(clients2, {
        cards: DECK,
        include: "matched+near",
        offset: page1.next_offset!,
      }),
    );
    const displaced = `matched-${page1.combos.length + 1}`;
    assert.equal(page2.combos[0]!.id, displaced);
    assert.equal(page2.combos[0]!.bucket, "included");
  });

  test("[requirement 9] a negative, fractional or non-finite offset normalizes to 0", async () => {
    for (const offset of [-1, -100, 2.7, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { clients } = deckBundle();

      const data = unwrap(await comboFindDeck(clients, { cards: DECK, offset }));

      assert.equal(data.offset, offset === 2.7 ? 2 : 0, String(offset));
    }
  });

  test("[Slice 17 #14] an offset past the end is bad_request with NO status", async () => {
    const { clients } = deckBundle();

    const result = await comboFindDeck(clients, { cards: DECK, offset: 8 });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "bad_request");
    // No `status`: our determination from a 200 body, not an HTTP outcome.
    assert.equal("status" in result.error, false);
    assert.match(result.error.message, /8 combos match/);
    assert.match(result.error.message, /valid offsets are 0-7/);
    assert.match(result.error.message, /not a deck that matched nothing/);
  });

  test("[Slice 17 #14] a deck matching nothing is a SUCCESSFUL empty result", async () => {
    // The two must not collapse. An out-of-range offset that read as "no combos" would send the
    // model away from a deck that has plenty.
    const { clients } = deckBundle(deckPayload({}));

    const data = unwrap(await comboFindDeck(clients, { cards: DECK }));

    assert.equal(data.total_combos, 0);
    assert.deepEqual(data.combos, []);
    assert.equal(data.has_more, false);
    assert.equal("next_offset" in data, false);
    assert.deepEqual(data.unresolved_cards, []);
  });
});

describe("comboFindDeck — refusals, each with ZERO upstream calls", () => {
  const emptyDecks: Array<[string, string[] | undefined]> = [
    ["an empty array", []],
    ["an absent cards", undefined],
    ["only empty strings", ["", ""]],
    ["only whitespace", ["   ", "\t", "\n"]],
  ];

  for (const [label, cards] of emptyDecks) {
    test(`[CAP-02 #13] ${label} is bad_request and calls neither source`, async () => {
      const { clients, scryfallPosts, spellbookPosts } = makeBundle(() => undefined, () => undefined);

      const result = await comboFindDeck(clients, { cards: cards as string[] });

      assert.equal(result.ok, false);
      assert.equal(!result.ok && result.error.code, "bad_request");
      // Not even name resolution. A GET with no deck returns HTTP 200 carrying the entire combo
      // corpus as near-misses, which is the well-formed meaningless answer this refusal prevents.
      assert.equal(scryfallPosts.length, 0, label);
      assert.equal(spellbookPosts.length, 0, label);
    });
  }

  test("[requirement 12] 601 main cards is refused before any call", async () => {
    const { clients, scryfallPosts, spellbookPosts } = makeBundle(() => undefined, () => undefined);

    const result = await comboFindDeck(clients, {
      cards: Array.from({ length: 601 }, (_, i) => `Card ${i + 1}`),
    });

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, "bad_request");
    assert.match(!result.ok ? result.error.message : "", /601 entries.*at most 600/);
    assert.equal(scryfallPosts.length, 0);
    assert.equal(spellbookPosts.length, 0);
  });

  test("[requirement 12] exactly 600 main cards is accepted", async () => {
    const { clients } = deckBundle();

    const result = await comboFindDeck(clients, {
      cards: Array.from({ length: 600 }, (_, i) => `Card ${i + 1}`),
    });

    assert.equal(result.ok, true);
  });

  test("[requirement 12] 13 commanders is refused before any call", async () => {
    const { clients, scryfallPosts, spellbookPosts } = makeBundle(() => undefined, () => undefined);

    const result = await comboFindDeck(clients, {
      cards: DECK,
      commanders: Array.from({ length: 13 }, (_, i) => `Commander ${i + 1}`),
    });

    assert.equal(result.ok, false);
    assert.match(!result.ok ? result.error.message : "", /13 entries.*at most 12/);
    assert.equal(scryfallPosts.length, 0);
    assert.equal(spellbookPosts.length, 0);
  });

  test("[CAP-02 #14] an unknown format is refused before any call", async () => {
    const { clients, scryfallPosts, spellbookPosts } = makeBundle(() => undefined, () => undefined);

    const result = await comboFindDeck(clients, { cards: DECK, format: "historic" });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "bad_request");
    assert.equal("status" in result.error, false);
    assert.match(result.error.message, /historic/);
    assert.match(result.error.message, /standardBrawl/);
    assert.equal(scryfallPosts.length, 0);
    assert.equal(spellbookPosts.length, 0);
  });

  test("[D-10] an upstream failure passes through, and a 404 stays a failure", async () => {
    // Deliberately NOT CAP-01's 404-as-empty mapping: this source answers a request with no matches
    // as an HTTP 200, so a 404 means a bad path.
    const failure: Result<unknown> = {
      ok: false,
      error: { code: "not_found", message: "Commander Spellbook found no match.", status: 404 },
    };
    const { clients } = makeBundle(echoAllFound, () => failure);

    const result = await comboFindDeck(clients, { cards: DECK });

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, "not_found");
  });

  test("[D-10] a rejecting client is caught by the handler's own backstop", async () => {
    const clients: Clients = {
      scryfall: fakeSource(echoAllFound).client,
      spellbook: { get: refuseGet, post: () => Promise.reject(new Error("socket hang up")) },
    };

    const result = await comboFindDeck(clients, { cards: DECK });

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, "unexpected");
    assert.match(!result.ok ? result.error.message : "", /socket hang up/);
  });
});

describe("comboFindDeck — one format, one boolean", () => {
  test("[CAP-02 #14] legality is reported for the format named, and no other appears", async () => {
    const { clients } = deckBundle();

    const data = unwrap(await comboFindDeck(clients, { cards: DECK, format: "modern" }));

    assert.equal(data.format, "modern");
    for (const combo of data.combos) assert.equal(typeof combo.legal, "boolean");
    // None of Commander Spellbook's other 15 keys reaches the serialized response.
    const serialized = JSON.stringify(data);
    for (const key of ["pauperCommanderMain", "standardBrawl", "competitiveBrawl", "predh", "vintage"]) {
      assert.equal(serialized.includes(key), false, key);
    }
    // And never Scryfall's string values.
    assert.equal(serialized.includes("not_legal"), false);
  });

  test('[requirement 14] the "edh" alias resolves to commander, unchanged from Slice 16', async () => {
    const { clients } = deckBundle();

    const data = unwrap(await comboFindDeck(clients, { cards: DECK, format: "EDH" }));

    assert.equal(data.format, "commander");
  });

  test("upstream dropping the requested legality key is reported, never read as 'not legal'", async () => {
    const stripped = {
      ...(includedVariant as Record<string, unknown>),
      legalities: { commander: true }, // `modern` absent
    };
    const { clients } = deckBundle(deckPayload({ included: [stripped] }));

    const result = await comboFindDeck(clients, { cards: DECK, format: "modern" });

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, "unexpected");
    assert.match(!result.ok ? result.error.message : "", /modern/);
  });
});

describe("comboFindDeck — the omissions that are the mechanism", () => {
  test("[CAP-02 #6] no Commander Spellbook price field survives into the response", async () => {
    for (const field of ["tcgplayer", "cardkingdom", "cardmarket", "prices"]) {
      assert.ok(
        deckFixtureText.includes(field),
        `fixture no longer carries "${field}" — sweep proves nothing`,
      );
    }

    const { clients } = deckBundle();
    const data = unwrap(await comboFindDeck(clients, { cards: DECK, include: "matched+near" }));
    const serialized = JSON.stringify(data);

    for (const field of ["tcgplayer", "cardkingdom", "cardmarket", "prices"]) {
      assert.equal(serialized.includes(field), false, field);
    }
  });

  test("[CAP-02 #7] no imageUri field, and no reconstructed image host", async () => {
    assert.ok(
      deckFixtureText.toLowerCase().includes("imageuri"),
      "fixture carries no imageUri — sweep is vacuous",
    );

    const { clients } = deckBundle();
    const data = unwrap(await comboFindDeck(clients, { cards: DECK, include: "matched+near" }));
    const serialized = JSON.stringify(data);

    assert.equal(serialized.toLowerCase().includes("imageuri"), false);
    // MCP-PRD OQ-13: an image URL must never be assembled from an id or oracleId either.
    assert.equal(serialized.includes("cards.scryfall.io"), false);
  });

  test("[requirement 15] the Scryfall cards fetched for name resolution are never surfaced", async () => {
    // `collection-not-found.json` carries two COMPLETE Scryfall card objects. Nothing but
    // `not_found[].name` may reach the caller — no oracle text, no price, no legality.
    const { clients } = makeBundle(canned(collectionNotFound), canned(bogusNameFixture));

    const data = unwrap(
      await comboFindDeck(clients, {
        cards: ["Demonic Consultation", "Thassa's Oracle", "Zzzz Not A Real Card 9999"],
      }),
    );
    const serialized = JSON.stringify(data);

    assert.equal(serialized.includes("oracle_text"), false);
    assert.equal(serialized.includes("purchase_uris"), false);
    assert.equal(serialized.includes("usd"), false);
    assert.equal(serialized.includes("collector_number"), false);
  });
});
