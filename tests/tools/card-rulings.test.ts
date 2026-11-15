import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Result } from "../../src/result.ts";
import type { HttpClient } from "../../src/http/client.ts";
import { cardRulings } from "../../src/tools/card-rulings.ts";

// Loaded at runtime, like every other suite here.
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
}

/**
 * VERBATIM Scryfall `POST /cards/collection`: Demonic Consultation and Thassa's Oracle resolved,
 * `not_found: [{"name":"Zzzz Not A Real Card 9999"}]`.
 */
const collectionNotFound = fixture("collection-not-found.json");

/** VERBATIM `GET /cards/{id}/rulings` for Blood Artist, captured 2026-11-15 (MCP-PRD §4.1.5). */
const bloodArtistRulings = fixture("rulings-blood-artist.json");

/**
 * DERIVED: the same envelope with an empty `data`. A card with no rulings is an ordinary
 * outcome — most cards have none — and this is what the endpoint's list envelope looks like then.
 */
const noRulings = { object: "list", has_more: false, data: [] };

/** DERIVED: the capture cut to its Demonic Consultation card object, for single-card cases. */
const consultation = (collectionNotFound as { data: unknown[] }).data[0];
const consultationOnly = { object: "list", not_found: [], data: [consultation] };

const CONSULTATION_ID = "1d779f19-3068-4976-b96b-8f93d156900b";
const ORACLE_ID = "726e8b29-13e9-4138-b6a9-d2a0d8188d1c";

/**
 * A fake Scryfall. `post` answers `/cards/collection` with `collection`; `get` answers from
 * `rulings`, keyed by path. Anything unscripted REJECTS, so "how many calls, to where" assertions
 * cannot pass vacuously.
 */
function fakeScryfall(
  collection: Result<unknown> | undefined,
  rulings: Record<string, Result<unknown>>,
): { client: HttpClient; gets: string[]; posts: string[] } {
  const gets: string[] = [];
  const posts: string[] = [];
  const client: HttpClient = {
    get(path) {
      gets.push(path);
      const reply = rulings[path];
      return reply === undefined
        ? Promise.reject(new Error(`fake: unscripted GET ${path}`))
        : Promise.resolve(reply);
    },
    post(path) {
      posts.push(path);
      return collection === undefined || path !== "/cards/collection"
        ? Promise.reject(new Error(`fake: unscripted POST ${path}`))
        : Promise.resolve(collection);
    },
  };
  return { client, gets, posts };
}

describe("cardRulings — the cap", () => {
  const names = (n: number): string[] => Array.from({ length: n }, (_, i) => `Card ${i + 1}`);

  test("eleven names is a structured bad_request naming the cap, and nothing is requested", async () => {
    const { client, gets, posts } = fakeScryfall(undefined, {});

    const result = await cardRulings(client, { cards: names(11) });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "bad_request");
    assert.match(result.error.message, /\b10\b/);
    assert.match(result.error.message, /\b11\b/);
    assert.equal(result.error.status, undefined);
    assert.deepEqual(posts, []);
    assert.deepEqual(gets, []);
  });

  test("ten names is within the cap", async () => {
    // Every name a miss, so the only call is the one batch resolution.
    const { client, gets, posts } = fakeScryfall(
      {
        ok: true,
        value: { object: "list", not_found: names(10).map((name) => ({ name })), data: [] },
      },
      {},
    );

    const result = await cardRulings(client, { cards: names(10) });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value.cards, []);
    assert.deepEqual(result.value.unresolved_cards, names(10));
    assert.deepEqual(posts, ["/cards/collection"]);
    assert.deepEqual(gets, []);
  });

  test("an empty or all-blank list is a bad_request, and nothing is requested", async () => {
    for (const cards of [[], ["", "   "]]) {
      const { client, gets, posts } = fakeScryfall(undefined, {});

      const result = await cardRulings(client, { cards });

      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.error.code, "bad_request");
      assert.deepEqual(posts, []);
      assert.deepEqual(gets, []);
    }
  });
});

describe("cardRulings — failures are returned, never thrown (D-10)", () => {
  const upstream503: Result<unknown> = {
    ok: false,
    error: { code: "upstream_unavailable", message: "Scryfall returned HTTP 503.", status: 503 },
  };

  test("a failed rulings request returns that failure unchanged — no partial answer", async () => {
    const { client, gets } = fakeScryfall(
      { ok: true, value: collectionNotFound },
      {
        [`/cards/${CONSULTATION_ID}/rulings`]: upstream503,
        [`/cards/${ORACLE_ID}/rulings`]: { ok: true, value: noRulings },
      },
    );

    const result = await cardRulings(client, { cards: ["Demonic Consultation", "Thassa's Oracle"] });

    // A partial result would report the second card as ruled on and silently omit the first.
    assert.deepEqual(result, upstream503);
    assert.deepEqual(gets, [`/cards/${CONSULTATION_ID}/rulings`]);
  });

  test("a failed name resolution returns that failure, and no rulings are requested", async () => {
    const { client, gets } = fakeScryfall(upstream503, {});

    const result = await cardRulings(client, { cards: ["Blood Artist"] });

    assert.deepEqual(result, upstream503);
    assert.deepEqual(gets, []);
  });

  test("a client that throws becomes a structured unexpected", async () => {
    // Collection resolves; the rulings GET is unscripted, so the fake REJECTS.
    const { client } = fakeScryfall({ ok: true, value: collectionNotFound }, {});

    const result = await cardRulings(client, { cards: ["Demonic Consultation"] });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "unexpected");
    assert.match(result.error.message, /unscripted GET/);
  });

  test("a rulings body with no data array is a structured unexpected naming the card", async () => {
    const { client } = fakeScryfall(
      { ok: true, value: collectionNotFound },
      { [`/cards/${CONSULTATION_ID}/rulings`]: { ok: true, value: { object: "error" } } },
    );

    const result = await cardRulings(client, { cards: ["Demonic Consultation"] });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "unexpected");
    assert.match(result.error.message, /Demonic Consultation/);
  });
});

describe("cardRulings — a mixed batch", () => {
  test("resolved cards carry their rulings and page link; the miss is reported, not dropped", async () => {
    const { client, gets, posts } = fakeScryfall(
      { ok: true, value: collectionNotFound },
      {
        [`/cards/${CONSULTATION_ID}/rulings`]: { ok: true, value: bloodArtistRulings },
        [`/cards/${ORACLE_ID}/rulings`]: { ok: true, value: noRulings },
      },
    );

    const result = await cardRulings(client, {
      cards: ["Demonic Consultation", "Thassa's Oracle", "Zzzz Not A Real Card 9999"],
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value, {
      cards: [
        {
          name: "Demonic Consultation",
          scryfall_uri: "https://scryfall.com/card/me2/85/demonic-consultation?utm_source=api",
          rulings: [
            {
              source: "wotc",
              published_at: "2016-06-08",
              comment:
                "If Blood Artist and one or more other creatures die at the same time, its ability " +
                "will trigger for each of those creatures.",
            },
          ],
        },
        {
          name: "Thassa's Oracle",
          scryfall_uri: "https://scryfall.com/card/thb/73/thassas-oracle?utm_source=api",
          rulings: [],
        },
      ],
      unresolved_cards: ["Zzzz Not A Real Card 9999"],
    });
    // One batch resolution, then exactly one rulings request per resolved card — none for the miss.
    assert.deepEqual(posts, ["/cards/collection"]);
    assert.deepEqual(gets, [`/cards/${CONSULTATION_ID}/rulings`, `/cards/${ORACLE_ID}/rulings`]);
  });

  test("a rulings list reporting has_more is flagged in a note, never paged and never silent", async () => {
    // DERIVED: never observed live (the one probe was `has_more: false`). One request per card is
    // the contract, so a longer list is reported as possibly incomplete rather than fetched further.
    const { client } = fakeScryfall(
      { ok: true, value: consultationOnly },
      {
        [`/cards/${CONSULTATION_ID}/rulings`]: {
          ok: true,
          value: { ...(bloodArtistRulings as object), has_more: true },
        },
      },
    );

    const result = await cardRulings(client, { cards: ["Demonic Consultation"] });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(result.value.note ?? "", /Demonic Consultation/);
  });

  test("a complete answer carries no note", async () => {
    const { client } = fakeScryfall(
      { ok: true, value: consultationOnly },
      { [`/cards/${CONSULTATION_ID}/rulings`]: { ok: true, value: noRulings } },
    );

    const result = await cardRulings(client, { cards: ["Demonic Consultation"] });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal("note" in result.value, false);
  });

  test("a matched card with no id or page link is reported unresolved with a note, never dropped", async () => {
    const handleless = { name: "Mystery Card" };
    const { client, gets } = fakeScryfall(
      { ok: true, value: { object: "list", not_found: [], data: [consultation, handleless] } },
      { [`/cards/${CONSULTATION_ID}/rulings`]: { ok: true, value: noRulings } },
    );

    const result = await cardRulings(client, { cards: ["Demonic Consultation", "Mystery Card"] });

    assert.ok(result.ok);
    assert.deepEqual(result.value.cards.map((c) => c.name), ["Demonic Consultation"]);
    assert.deepEqual(result.value.unresolved_cards, ["Mystery Card"]);
    assert.match(result.value.note ?? "", /Mystery Card/);
    assert.match(result.value.note ?? "", /no card id/i);
    assert.deepEqual(gets, [`/cards/${CONSULTATION_ID}/rulings`]);
  });

  test("a card resolved twice is requested and reported once", async () => {
    // e.g. "Thassa's Oracle" and "thassa's oracle": Scryfall resolves both to the same card object.
    const { client, gets } = fakeScryfall(
      { ok: true, value: { object: "list", not_found: [], data: [consultation, consultation] } },
      { [`/cards/${CONSULTATION_ID}/rulings`]: { ok: true, value: noRulings } },
    );

    const result = await cardRulings(client, {
      cards: ["Demonic Consultation", "demonic consultation"],
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.cards.length, 1);
    assert.deepEqual(gets, [`/cards/${CONSULTATION_ID}/rulings`]);
  });
});
