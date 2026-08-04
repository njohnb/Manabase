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
    const { client } = makeFakeClient({ ok: true, value: searchPage1 });

    const r = await cardSearch(client, { q: "t:creature", page: 4 });

    assert.ok(r.ok);
    assert.equal(r.value.page, 4);
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
  test("scalar fields are copied and legalities pass through untrimmed", async () => {
    const { client } = makeFakeClient({ ok: true, value: searchPage1 });

    const r = await cardSearch(client, { q: "t:creature" });
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
      page: "3",
    });
  });
});
