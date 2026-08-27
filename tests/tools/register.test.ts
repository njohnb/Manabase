import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Failure, Result } from "../../src/result.ts";
import type { HttpClient } from "../../src/http/client.ts";
import type { ScryfallList } from "../../src/scryfall/types.ts";
import type { SpellbookVariantList } from "../../src/spellbook/types.ts";
import type { CardSearchData } from "../../src/tools/card-search.ts";
import { cardSearch } from "../../src/tools/card-search.ts";
import type { ComboSearchData } from "../../src/tools/combo-search.ts";
import type { ComboFindDeckData } from "../../src/tools/combo-find-deck.ts";
import { dispatchToolCall, toolDefinitions } from "../../src/tools/register.ts";
import type { Clients } from "../../src/tools/register.ts";

// Same pattern as card-search.test.ts: loaded at runtime, so no `resolveJsonModule` and
// identical behaviour under type stripping and under the esbuild bundle.
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
}

const searchPage1 = fixture("search-page-1.json") as ScryfallList;
const variantsPage1 = fixture("spellbook/variants-page1.json") as SpellbookVariantList;
const findMyCombosDeck = fixture("spellbook/find-my-combos-deck.json");

/**
 * Synthesized, not a fixture: an all-found `POST /cards/collection` reply. The handler reads only
 * `data[].name` and `not_found[].name`, and these dispatch tests are about ROUTING — the real
 * `collection-not-found.json` belongs to the suite that tests the reporting of misses.
 */
const collectionAllFound = { object: "list", not_found: [], data: [{ name: "Sol Ring" }] };

interface RecordedCall {
  path: string;
  query: Record<string, string | undefined> | undefined;
}

/** Object-literal client that records its arguments and returns a canned Result. */
function makeFakeClient(result: Result<unknown>): { client: HttpClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const client: HttpClient = {
    get(path, query) {
      calls.push({ path, query });
      return Promise.resolve(result);
    },
    // Both tools reach their source by GET only. `post` exists because Slice 15 made both client
    // types aliases of the shared `HttpClient`; it rejects so an accidental POST fails loudly.
    post: (path: string) =>
      Promise.reject(new Error(`fake client: no tool in this slice may POST (${path})`)),
  };
  return { client, calls };
}

/**
 * Both clients at once, with DISTINGUISHABLE canned responses, so a handler reaching the wrong
 * source produces a wrong payload rather than a passing test.
 */
function makeClients(): {
  clients: Clients;
  scryfallCalls: RecordedCall[];
  spellbookCalls: RecordedCall[];
} {
  const scryfall = makeFakeClient({ ok: true, value: searchPage1 });
  const spellbook = makeFakeClient({ ok: true, value: variantsPage1 });
  return {
    clients: { scryfall: scryfall.client, spellbook: spellbook.client },
    scryfallCalls: scryfall.calls,
    spellbookCalls: spellbook.calls,
  };
}

interface PostedCall extends RecordedCall {
  body: unknown;
}

/**
 * Both clients with a WORKING post, for the one tool that uses the verb.
 *
 * `get` rejects on both: `combo_find_deck` reaches each source by POST only, and a lenient fake
 * would let a wrong verb pass unnoticed. The two canned bodies are different shapes, so a
 * mis-routed call produces a body the handler cannot read rather than a passing test.
 */
function makePostClients(spellbookBody: unknown = findMyCombosDeck): {
  clients: Clients;
  scryfallPosts: PostedCall[];
  spellbookPosts: PostedCall[];
} {
  const scryfallPosts: PostedCall[] = [];
  const spellbookPosts: PostedCall[] = [];

  const refuseGet = (path: string): Promise<never> =>
    Promise.reject(new Error(`fake client: combo_find_deck must not GET (${path})`));

  const clients: Clients = {
    scryfall: {
      get: refuseGet,
      post(path, body, query) {
        scryfallPosts.push({ path, body, query });
        return Promise.resolve({ ok: true, value: collectionAllFound });
      },
    },
    spellbook: {
      get: refuseGet,
      post(path, body, query) {
        spellbookPosts.push({ path, body, query });
        return Promise.resolve({ ok: true, value: spellbookBody });
      },
    },
  };

  return { clients, scryfallPosts, spellbookPosts };
}

/** One source only, for the CAP-01 cases that predate the bundle. */
function scryfallOnly(result: Result<unknown>): { clients: Clients; calls: RecordedCall[] } {
  const scryfall = makeFakeClient(result);
  const spellbook = makeFakeClient(result);
  return {
    clients: { scryfall: scryfall.client, spellbook: spellbook.client },
    calls: scryfall.calls,
  };
}

const EXPECTED_DESCRIPTION =
  "Search Magic: The Gathering cards using Scryfall query syntax, evaluated by Scryfall " +
  "itself — supports all operators including `t:`, `o:`, `f:`, `cmc`, `usd`, `otag:`, " +
  "`art:`, and regex (`o:/…/`). Returns per-card gameplay fields, format legalities, and a " +
  "USD price with finish. 88 cards per page; the response reports `total_cards` and " +
  "`has_more`. Legalities are trimmed to the format the query names (`legalities` to widen); " +
  "formats absent from `legalities_included` were not returned and are not claims about " +
  "legality.";

const EXPECTED_COMBO_DESCRIPTION =
  "Find Magic: The Gathering combos using Commander Spellbook query syntax, evaluated by " +
  "Commander Spellbook itself — `card:\"Thassa's Oracle\"` is the common case. Returns each " +
  "combo's cards, what it produces, mana needed, prerequisites, and a step-by-step description. " +
  "Pages are sized by bytes, not by a fixed count, so combos per page varies; the response " +
  "reports `total_combos`, `has_more` and `next_offset` — pass `next_offset` back as `offset` " +
  "for the next page, never a computed one. `format` names the single format legality is judged " +
  "for (default `commander`); these format names are not Scryfall's, and an unrecognized one is " +
  "refused rather than guessed. An invalid query returns Commander Spellbook's error text " +
  "verbatim — correct it and retry.";

const EXPECTED_FIND_DECK_DESCRIPTION =
  "Find which Magic: The Gathering combos a decklist already contains, and — with " +
  '`include: "matched+near"` — the ones it is one card away from, classified by Commander ' +
  "Spellbook. `cards` is main-deck card NAMES only: no quantities and no objects, so strip a " +
  'leading count ("1 Sol Ring" will not resolve). `commanders` is separate and optional. Every ' +
  "submitted name is checked against Scryfall first, and any it does not recognize is listed in " +
  "`unresolved_cards`, which is always present — Commander Spellbook ignores an unknown name " +
  "silently, so this is the only signal that a typo cost you combos. Submit a double-faced card " +
  "by ONE face name: the combined `Front // Back` form is reported unresolved even though the " +
  "card is real. Near-misses are the bulk of " +
  "the data and are absent unless asked for. Pages are filled to a byte budget rather than to a " +
  "combo count, so combos per page varies: pass the previous response's `next_offset` back as " +
  "`offset`, never a computed one. Each call re-fetches and re-classifies the whole deck — there " +
  "is no cursor — and changing `include` or the decklist changes what an offset means, so restart " +
  "at 0. `format` names the single format legality is judged for (default `commander`); these " +
  "format names are not Scryfall's, and an unrecognized one is refused rather than guessed.";

const parseBody = (result: { content: Array<{ type: "text"; text: string }> }): unknown =>
  JSON.parse(result.content[0]!.text);

describe("toolDefinitions", () => {
  test("[CAP-01 #1] card_search is the first tool, with the spec's description", () => {
    const tool = toolDefinitions[0]!;
    assert.equal(tool.name, "card_search");
    assert.equal(tool.description, EXPECTED_DESCRIPTION);
  });

  test("[Slice 17 #19] tools/list reports exactly THREE tools", () => {
    assert.equal(toolDefinitions.length, 3);
    assert.deepEqual(
      toolDefinitions.map((t) => t.name),
      ["card_search", "combo_search", "combo_find_deck"],
    );
  });

  test("[requirement 14] combo_search carries the spec's description exactly", () => {
    // Asserted against a local constant on purpose: update this deliberately, never to make a
    // test pass. The description is resident context on every surface.
    assert.equal(toolDefinitions[1]!.description, EXPECTED_COMBO_DESCRIPTION);
  });

  test("[Slice 17 #19] combo_find_deck carries the spec's description exactly", () => {
    // Same rule as above: change this deliberately, never to make a test pass.
    assert.equal(toolDefinitions[2]!.description, EXPECTED_FIND_DECK_DESCRIPTION);
  });

  test("[Slice 17 requirement 11] the description tells the model to strip quantities", () => {
    // Requirement 11: a pasted "1 Sol Ring" surfaces in `unresolved_cards`, which is loud and
    // correct — but the model should not have to discover that by failing a call.
    const description = toolDefinitions[2]!.description;
    assert.match(description, /1 Sol Ring/);
    assert.match(description, /NAMES only/);
    // Requirement 9's two paging consequences: an offset means nothing under a different
    // `include`, and there is no cursor to resume from.
    assert.match(description, /no cursor/);
    assert.match(description, /restart\s+at 0/);
    // Measured live 2026-08-25: `POST /cards/collection` rejects the combined `Front // Back`
    // name, so four real cards in a 100-card deck were reported unresolved. The signal stays
    // honest only if the model knows the difference between that and a typo.
    assert.match(description, /Front \/\/ Back/);
  });

  test("[requirement 14] no description names a scoped tool name", () => {
    // The scoped form is constructed per surface and is not a property of the server
    // (PLUGIN-PRD P-12), so a hardcoded one is wrong somewhere by construction.
    for (const tool of toolDefinitions) {
      assert.equal(tool.description.includes("mcp__plugin"), false, tool.name);
      assert.equal(tool.description.includes("Manabase:"), false, tool.name);
    }
  });

  test("combo_search input schema requires q and declares offset and format", () => {
    const schema = toolDefinitions[1]!.inputSchema as {
      type: string;
      required: string[];
      properties: Record<string, { type: string; enum?: string[]; minimum?: number }>;
    };

    assert.equal(schema.type, "object");
    assert.deepEqual(schema.required, ["q"]);
    assert.deepEqual(Object.keys(schema.properties), ["q", "offset", "format"]);
    assert.equal(schema.properties.q!.type, "string");
    // 0-based and minimum 0, not a 1-based page: the page size is not constant, so a page number
    // cannot express where the next page starts.
    assert.equal(schema.properties.offset!.type, "integer");
    assert.equal(schema.properties.offset!.minimum, 0);
    // A string, NOT a 16-value enum: sixteen values is a large resident cost for a parameter
    // almost nobody sets, and the handler's refusal names the valid set when it matters.
    assert.equal(schema.properties.format!.type, "string");
    assert.equal(schema.properties.format!.enum, undefined);
  });

  test("[Slice 17 #19] combo_find_deck input schema requires cards and declares the four optionals", () => {
    const schema = toolDefinitions[2]!.inputSchema as {
      type: string;
      required: string[];
      properties: Record<
        string,
        { type: string; enum?: string[]; minimum?: number; minItems?: number; items?: { type: string } }
      >;
    };

    assert.equal(schema.type, "object");
    assert.deepEqual(schema.required, ["cards"]);
    assert.deepEqual(Object.keys(schema.properties), [
      "cards", "commanders", "include", "offset", "format",
    ]);
    // `string[]`, not objects and not `{name, quantity}` — quantity carries no combo information
    // (Slice 17 requirement 11).
    assert.equal(schema.properties.cards!.type, "array");
    assert.equal(schema.properties.cards!.items!.type, "string");
    assert.equal(schema.properties.cards!.minItems, 1);
    assert.equal(schema.properties.commanders!.type, "array");
    // Additive and defaulting to cheap: forgetting it returns a smaller TRUE answer rather than
    // failing a call invisibly (MCP-PRD OQ-13's direction).
    assert.deepEqual(schema.properties.include!.enum, ["matched", "matched+near"]);
    assert.equal(schema.properties.offset!.type, "integer");
    assert.equal(schema.properties.offset!.minimum, 0);
    assert.equal(schema.properties.format!.type, "string");
  });

  test("input schema requires q and declares the documented optionals", () => {
    const schema = toolDefinitions[0]!.inputSchema as {
      type: string;
      required: string[];
      properties: Record<string, { type: string; enum?: string[]; minimum?: number }>;
    };

    assert.equal(schema.type, "object");
    assert.deepEqual(schema.required, ["q"]);
    assert.deepEqual(Object.keys(schema.properties), [
      "q", "unique", "order", "dir", "page", "legalities",
    ]);
    assert.equal(schema.properties.q!.type, "string");
    assert.deepEqual(schema.properties.unique!.enum, ["cards", "prints", "art"]);
    assert.equal(schema.properties.order!.type, "string");
    assert.deepEqual(schema.properties.dir!.enum, ["auto", "asc", "desc"]);
    assert.equal(schema.properties.page!.type, "integer");
    assert.equal(schema.properties.page!.minimum, 1);
    assert.deepEqual(schema.properties.legalities!.enum, ["queried", "default", "all"]);
  });
});

describe("dispatchToolCall — success", () => {
  test("valid args produce a non-error result whose text is the shaped CardSearchData", async () => {
    const { clients, calls } = scryfallOnly({ ok: true, value: searchPage1 });

    const result = await dispatchToolCall(clients, "card_search", { q: "t:goblin" });

    assert.ok(!("isError" in result) || result.isError !== true);
    assert.equal(result.content.length, 1);
    assert.equal(result.content[0]!.type, "text");

    // The payload is exactly what the handler produced — dispatch reshapes nothing.
    const expected = await cardSearch(makeFakeClient({ ok: true, value: searchPage1 }).client, {
      q: "t:goblin",
    });
    assert.ok(expected.ok);
    assert.deepEqual(parseBody(result), JSON.parse(JSON.stringify(expected.value)));

    // Handler defaults reached the client untouched.
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.path, "/cards/search");
    assert.equal(calls[0]!.query!.q, "t:goblin");
    assert.equal(calls[0]!.query!.unique, "cards");
    assert.equal(calls[0]!.query!.page, "1");
  });

  test("well-typed optionals pass through", async () => {
    const { clients, calls } = scryfallOnly({ ok: true, value: searchPage1 });

    const result = await dispatchToolCall(clients, "card_search", {
      q: "t:dragon",
      unique: "prints",
      order: "cmc",
      dir: "desc",
      page: 3,
    });

    assert.ok(!("isError" in result) || result.isError !== true);
    assert.deepEqual(calls[0]!.query, {
      q: "t:dragon",
      unique: "prints",
      order: "cmc",
      dir: "desc",
      // Our pages are half an upstream page, so page 3 is the first half of upstream page 2.
      page: "2",
    });
  });

  test("legalities: a valid enum reaches the handler; anything else falls back to queried", async () => {
    for (const [sent, expected] of [
      ["all", "all"],
      ["default", "default"],
      // Wrong-typed and unknown values are dropped rather than rejected, so the handler's
      // "queried" default takes over (MCP-PRD D-10 — no throwing, no error for a bad optional).
      [42, "queried"],
      ["verbose", "queried"],
      [undefined, "queried"],
    ] as const) {
      const { clients } = scryfallOnly({ ok: true, value: searchPage1 });
      const result = await dispatchToolCall(clients, "card_search", {
        q: "t:dragon f:commander",
        ...(sent !== undefined ? { legalities: sent } : {}),
      });
      assert.ok(!("isError" in result) || result.isError !== true);
      const body = parseBody(result) as { legalities_mode: string };
      assert.equal(body.legalities_mode, expected, `legalities: ${JSON.stringify(sent)}`);
    }
  });

  test("wrong-typed optionals and unknown keys are dropped, not rejected", async () => {
    const { clients, calls } = scryfallOnly({ ok: true, value: searchPage1 });

    const result = await dispatchToolCall(clients, "card_search", {
      q: "t:goblin",
      page: "3",          // string, not integer
      unique: "bogus",    // not in the enum
      dir: 7,             // not a string
      order: 42,          // not a string
      colour: "blue",     // unknown key
    });

    assert.ok(!("isError" in result) || result.isError !== true);
    const parsed = parseBody(result) as CardSearchData;
    assert.equal(parsed.page, 1);
    assert.deepEqual(calls[0]!.query, {
      q: "t:goblin",
      unique: "cards",
      order: undefined,
      dir: undefined,
      page: "1",
    });
  });
});

describe("dispatchToolCall — handler failure is a structured result", () => {
  test("[CAP-01 #3] bad_request comes back as isError with Scryfall's details verbatim", async () => {
    const error: Failure["error"] = {
      code: "bad_request",
      message: "Scryfall rejected the request as malformed.",
      details: "All of your terms were ignored.",
      status: 400,
    };
    const { clients } = scryfallOnly({ ok: false, error });

    const result = await dispatchToolCall(clients, "card_search", { q: "illustrationtag:dragon" });

    assert.equal(result.isError, true);
    const body = parseBody(result) as { error: Failure["error"] };
    assert.equal(body.error.code, "bad_request");
    assert.equal(body.error.details, "All of your terms were ignored.");
    assert.equal(body.error.status, 400);
    assert.deepEqual(body.error, error);
  });
});

describe("dispatchToolCall — argument validation", () => {
  const badArgs: Array<[string, unknown]> = [
    ["undefined", undefined],
    ["null", null],
    ["a string", "q=t:goblin"],
    ["an array", [{ q: "t:goblin" }]],
    ["an object with no q", { unique: "cards" }],
    ["an object with a non-string q", { q: 42 }],
  ];

  for (const [label, args] of badArgs) {
    test(`[CAP-01 #4] ${label} yields bad_request without throwing`, async () => {
      const { clients, calls } = scryfallOnly({ ok: true, value: searchPage1 });

      const result = await dispatchToolCall(clients, "card_search", args);

      assert.equal(result.isError, true);
      const body = parseBody(result) as { error: { code: string; message: string } };
      assert.equal(body.error.code, "bad_request");
      assert.ok(body.error.message.length > 0);
      assert.equal(calls.length, 0); // never reaches the network layer
    });
  }
});

describe("dispatchToolCall — unknown tool name", () => {
  test("[CAP-01 #4] rejects — the one protocol-level error", async () => {
    const { clients, calls } = scryfallOnly({ ok: true, value: searchPage1 });

    await assert.rejects(
      dispatchToolCall(clients, "nope", { q: "t:goblin" }),
      /nope/,
    );
    assert.equal(calls.length, 0);
  });

  test("[Slice 17 #19] an unknown name still throws now that there are three tools", async () => {
    const { clients, scryfallCalls, spellbookCalls } = makeClients();

    // Slice 16 used `combo_find_deck` here as the not-yet-real name. It is real now, so the probe
    // moved to a name no slice will ever claim — a tool that exists must never be the evidence
    // that unknown tools throw.
    await assert.rejects(dispatchToolCall(clients, "deck_read", { q: "x" }), /deck_read/);

    assert.equal(scryfallCalls.length, 0);
    assert.equal(spellbookCalls.length, 0);
  });
});

describe("dispatchToolCall — each tool reaches ONE source", () => {
  test("[requirement 12] card_search reaches scryfall and never spellbook", async () => {
    const { clients, scryfallCalls, spellbookCalls } = makeClients();

    const result = await dispatchToolCall(clients, "card_search", { q: "t:goblin" });

    assert.ok(!("isError" in result) || result.isError !== true);
    assert.equal(scryfallCalls.length, 1);
    assert.equal(scryfallCalls[0]!.path, "/cards/search");
    assert.equal(spellbookCalls.length, 0);
    // The two fakes return different fixtures, so a mis-route is a wrong payload, not a pass.
    assert.ok("cards" in (parseBody(result) as object));
  });

  test("[requirement 12] combo_search reaches spellbook and never scryfall", async () => {
    const { clients, scryfallCalls, spellbookCalls } = makeClients();

    const result = await dispatchToolCall(clients, "combo_search", { q: 'card:"Thassa\'s Oracle"' });

    assert.ok(!("isError" in result) || result.isError !== true);
    assert.equal(spellbookCalls.length, 1);
    assert.equal(spellbookCalls[0]!.path, "/variants/");
    assert.equal(scryfallCalls.length, 0);

    const body = parseBody(result) as ComboSearchData;
    assert.equal(body.combos.length, 40); // the whole cheap fixture fits one byte-budgeted page
    assert.equal(body.total_combos, 96);
    assert.equal(body.format, "commander");
  });

  test("[Slice 17 #19] combo_find_deck is the ONE tool that reaches both sources", async () => {
    const { clients, scryfallPosts, spellbookPosts } = makePostClients();

    const result = await dispatchToolCall(clients, "combo_find_deck", {
      cards: ["Demonic Consultation", "Thassa's Oracle"],
    });

    assert.ok(!("isError" in result) || result.isError !== true);
    assert.equal(scryfallPosts.length, 1);
    assert.equal(scryfallPosts[0]!.path, "/cards/collection");
    assert.equal(spellbookPosts.length, 1);
    assert.equal(spellbookPosts[0]!.path, "/find-my-combos");

    const body = parseBody(result) as ComboFindDeckData;
    assert.equal(body.include, "matched");
    assert.equal(body.color_identity, "UBR");
    assert.deepEqual(body.unresolved_cards, []);
  });
});

describe("dispatchToolCall — combo_find_deck argument handling", () => {
  test("[Slice 17 #8] a missing, empty or non-array cards is bad_request with no upstream call", async () => {
    const badArgs: Array<[string, unknown]> = [
      ["undefined", undefined],
      ["null", null],
      ["a string", "Sol Ring"],
      ["an array", [["Sol Ring"]]],
      ["an object with no cards", { format: "commander" }],
      ["an empty cards array", { cards: [] }],
      ["cards of only empty strings", { cards: ["", "   "] }],
      ["a non-array cards", { cards: "Sol Ring" }],
      ["cards of only non-strings", { cards: [1, 2, 3] }],
    ];

    for (const [label, args] of badArgs) {
      const { clients, scryfallPosts, spellbookPosts } = makePostClients();

      const result = await dispatchToolCall(clients, "combo_find_deck", args);

      assert.equal(result.isError, true, label);
      const body = parseBody(result) as { error: { code: string; message: string } };
      assert.equal(body.error.code, "bad_request", label);
      // Zero calls to EITHER source — not even name resolution.
      assert.equal(scryfallPosts.length, 0, label);
      assert.equal(spellbookPosts.length, 0, label);
    }
  });

  test("[Slice 17 #19] well-typed optionals reach the handler; wrong-typed ones are dropped", async () => {
    const { clients, spellbookPosts } = makePostClients();

    const result = await dispatchToolCall(clients, "combo_find_deck", {
      cards: ["Demonic Consultation", "Thassa's Oracle"],
      commanders: ["Thrasios, Triton Hero"],
      include: "matched+near",
      offset: "2", // string, not integer — dropped, so the handler's 0 applies
      format: 42, // not a string — dropped, so the handler's "commander" applies
      q: "ignored", // an unknown key belonging to another tool
    });

    assert.ok(!("isError" in result) || result.isError !== true);
    const body = parseBody(result) as ComboFindDeckData;
    assert.equal(body.include, "matched+near");
    assert.equal(body.offset, 0);
    assert.equal(body.format, "commander");
    assert.deepEqual(spellbookPosts[0]!.body, {
      main: [{ card: "Demonic Consultation", quantity: 1 }, { card: "Thassa's Oracle", quantity: 1 }],
      commanders: [{ card: "Thrasios, Triton Hero", quantity: 1 }],
    });
  });

  test("[Slice 17 #9] an unknown format is a structured result, not a throw", async () => {
    const { clients, scryfallPosts, spellbookPosts } = makePostClients();

    const result = await dispatchToolCall(clients, "combo_find_deck", {
      cards: ["Sol Ring"],
      format: "historic",
    });

    assert.equal(result.isError, true);
    const body = parseBody(result) as { error: { code: string; message: string } };
    assert.equal(body.error.code, "bad_request");
    assert.match(body.error.message, /historic/);
    assert.equal(scryfallPosts.length, 0);
    assert.equal(spellbookPosts.length, 0);
  });
});

describe("dispatchToolCall — combo_search argument handling", () => {
  test("[requirement 13] a missing or non-string q is bad_request with no upstream call", async () => {
    const badArgs: Array<[string, unknown]> = [
      ["undefined", undefined],
      ["null", null],
      ["a string", 'q=card:"x"'],
      ["an array", [{ q: "x" }]],
      ["an object with no q", { format: "commander" }],
      ["an object with a non-string q", { q: 42 }],
    ];

    for (const [label, args] of badArgs) {
      const { clients, spellbookCalls } = makeClients();

      const result = await dispatchToolCall(clients, "combo_search", args);

      assert.equal(result.isError, true, label);
      const body = parseBody(result) as { error: { code: string; message: string } };
      assert.equal(body.error.code, "bad_request", label);
      assert.match(body.error.message, /Commander Spellbook/, label);
      assert.equal(spellbookCalls.length, 0, label);
    }
  });

  test("[requirement 13] a wrong-typed offset or format is dropped and the default applies", async () => {
    const { clients, spellbookCalls } = makeClients();

    const result = await dispatchToolCall(clients, "combo_search", {
      q: "x",
      offset: "3",      // string, not integer
      format: 42,       // not a string
      include: "near",  // unknown key — Slice 17's, and not accepted here
      page: 2,          // the RETIRED parameter: silently ignored, never re-interpreted
    });

    assert.ok(!("isError" in result) || result.isError !== true);
    const body = parseBody(result) as ComboSearchData;
    assert.equal(body.offset, 0);
    assert.equal(body.format, "commander");
    assert.equal(spellbookCalls[0]!.query!.offset, "0");
  });

  test("[requirement 13] well-typed offset and format reach the handler", async () => {
    const { clients, spellbookCalls } = makeClients();

    const result = await dispatchToolCall(clients, "combo_search", {
      q: "x",
      offset: 40,
      format: "modern",
    });

    assert.ok(!("isError" in result) || result.isError !== true);
    assert.deepEqual(spellbookCalls[0]!.query, {
      q: "x",
      limit: "60",
      offset: "40",
      count: "true",
    });
    assert.equal((parseBody(result) as ComboSearchData).format, "modern");
  });

  test("[requirement 7] an unknown format is a structured result, not a throw", async () => {
    const { clients, spellbookCalls } = makeClients();

    const result = await dispatchToolCall(clients, "combo_search", { q: "x", format: "historic" });

    assert.equal(result.isError, true);
    const body = parseBody(result) as { error: { code: string; message: string } };
    assert.equal(body.error.code, "bad_request");
    assert.match(body.error.message, /historic/);
    assert.equal(spellbookCalls.length, 0);
  });
});
