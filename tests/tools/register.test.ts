import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Failure, Result } from "../../src/result.ts";
import type { ScryfallClient } from "../../src/scryfall/client.ts";
import type { ScryfallList } from "../../src/scryfall/types.ts";
import type { CardSearchData } from "../../src/tools/card-search.ts";
import { cardSearch } from "../../src/tools/card-search.ts";
import { dispatchToolCall, toolDefinitions } from "../../src/tools/register.ts";

// Same pattern as card-search.test.ts: loaded at runtime, so no `resolveJsonModule` and
// identical behaviour under type stripping and under the esbuild bundle.
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
}

const searchPage1 = fixture("search-page-1.json") as ScryfallList;

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
    // `card_search` reaches Scryfall by GET only. `post` exists because Slice 15 made
    // `ScryfallClient` the shared `HttpClient`; it rejects so an accidental POST fails loudly.
    post: (path: string) =>
      Promise.reject(new Error(`fake client: card_search must not POST (${path})`)),
  };
  return { client, calls };
}

const EXPECTED_DESCRIPTION =
  "Search Magic: The Gathering cards using Scryfall query syntax, evaluated by Scryfall " +
  "itself — supports all operators including `t:`, `o:`, `f:`, `cmc`, `usd`, `otag:`, " +
  "`art:`, and regex (`o:/…/`). Returns per-card gameplay fields, format legalities, and a " +
  "USD price with finish. 88 cards per page; the response reports `total_cards` and " +
  "`has_more`. Legalities are trimmed to the format the query names (`legalities` to widen); " +
  "formats absent from `legalities_included` were not returned and are not claims about " +
  "legality.";

const parseBody = (result: { content: Array<{ type: "text"; text: string }> }): unknown =>
  JSON.parse(result.content[0]!.text);

describe("toolDefinitions", () => {
  test("[CAP-01 #1] exactly one tool, named card_search, with the spec's description", () => {
    assert.equal(toolDefinitions.length, 1);
    const tool = toolDefinitions[0]!;
    assert.equal(tool.name, "card_search");
    assert.equal(tool.description, EXPECTED_DESCRIPTION);
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
    const { client, calls } = makeFakeClient({ ok: true, value: searchPage1 });

    const result = await dispatchToolCall(client, "card_search", { q: "t:goblin" });

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
    const { client, calls } = makeFakeClient({ ok: true, value: searchPage1 });

    const result = await dispatchToolCall(client, "card_search", {
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
      const { client } = makeFakeClient({ ok: true, value: searchPage1 });
      const result = await dispatchToolCall(client, "card_search", {
        q: "t:dragon f:commander",
        ...(sent !== undefined ? { legalities: sent } : {}),
      });
      assert.ok(!("isError" in result) || result.isError !== true);
      const body = parseBody(result) as { legalities_mode: string };
      assert.equal(body.legalities_mode, expected, `legalities: ${JSON.stringify(sent)}`);
    }
  });

  test("wrong-typed optionals and unknown keys are dropped, not rejected", async () => {
    const { client, calls } = makeFakeClient({ ok: true, value: searchPage1 });

    const result = await dispatchToolCall(client, "card_search", {
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
    const { client } = makeFakeClient({ ok: false, error });

    const result = await dispatchToolCall(client, "card_search", { q: "illustrationtag:dragon" });

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
      const { client, calls } = makeFakeClient({ ok: true, value: searchPage1 });

      const result = await dispatchToolCall(client, "card_search", args);

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
    const { client, calls } = makeFakeClient({ ok: true, value: searchPage1 });

    await assert.rejects(
      dispatchToolCall(client, "nope", { q: "t:goblin" }),
      /nope/,
    );
    assert.equal(calls.length, 0);
  });
});
