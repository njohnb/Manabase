import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Config } from "../../src/config.ts";
import { createSpellbookClient } from "../../src/spellbook/client.ts";

const USER_AGENT = "manabase-mtg/0.0.0 (+https://github.com/njohnb/manabase)";

const config: Config = {
  userAgent: USER_AGENT,
  cacheDir: "unused",
  scryfallBaseUrl: "https://scryfall.test",
  spellbookBaseUrl: "https://spellbook.test",
};

// Loaded at runtime rather than imported: no `resolveJsonModule` / import attributes needed, and
// it behaves the same under type stripping and under the esbuild bundle. Read as text, because
// the client is handed a response body, not a parsed object.
function fixtureText(name: string): string {
  return readFileSync(new URL(`../fixtures/spellbook/${name}.json`, import.meta.url), "utf8");
}

/** Verbatim capture, 2026-08-24: `GET /variants/` with an unrecognized operator. */
const invalidQuery400 = fixtureText("variants-invalid-query-400");
/** Verbatim capture, 2026-08-24: a valid query matching nothing. HTTP 200, not 404. */
const emptyResult = fixtureText("variants-empty");

const UPSTREAM_MESSAGE = "Invalid search query: unexpected character : at position 34.";

interface RecordedCall {
  url: string;
  at: number;
  headers: Record<string, string>;
  method: string | undefined;
  body: unknown;
}

/** Same virtual clock as tests/http/client.test.ts: `sleep` advances time instead of passing it. */
function makeHarness(script: Array<Response | Error>) {
  let clock = 0;
  const sleeps: number[] = [];
  const calls: RecordedCall[] = [];
  const deps = {
    now: () => clock,
    sleep: (ms: number) => { sleeps.push(ms); clock += ms; return Promise.resolve(); },
    fetchImpl: ((input: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: String(input),
        at: clock,
        headers: { ...(init?.headers as Record<string, string>) },
        method: init?.method,
        body: init?.body,
      });
      const next = script.shift();
      if (next === undefined) return Promise.reject(new Error("mock fetch: script exhausted"));
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    }) as typeof fetch,
  };
  return { deps, sleeps, calls };
}

const ok200 = (body: string) => new Response(body, { status: 200 });
const err = (status: number, body: string) => new Response(body, { status });

describe("spellbook client — one lane at 500ms", () => {
  test("two sequential requests are 500ms apart", async () => {
    const { deps, sleeps, calls } = makeHarness([ok200("{}"), ok200("{}")]);
    const client = createSpellbookClient(config, deps);

    await client.get("/variants/", { q: "card:\"Thassa's Oracle\"" });
    await client.get("/variants/", { offset: "40" });

    assert.deepEqual(sleeps, [500]);
    assert.equal(calls[1]!.at - calls[0]!.at, 500);
  });

  test("every path shares the one lane — a POST queues behind a GET", async () => {
    const { deps, sleeps, calls } = makeHarness([ok200("{}"), ok200("{}")]);
    const client = createSpellbookClient(config, deps);

    await Promise.all([
      client.get("/variants/", { q: "x" }),
      client.post("/find-my-combos", { main: [], commanders: [] }),
    ]);

    assert.deepEqual(sleeps, [500]);
    assert.equal(calls[1]!.at - calls[0]!.at, 500);
    assert.equal(calls[1]!.method, "POST");
  });

  test("the base url comes from config and query params assemble the same way", async () => {
    const { deps, calls } = makeHarness([ok200("{}")]);
    const client = createSpellbookClient(config, deps);

    await client.get("/variants/", { q: "card:x", limit: "40", offset: undefined, count: "true" });

    assert.equal(calls[0]!.url, "https://spellbook.test/variants/?q=card%3Ax&limit=40&count=true");
  });
});

describe("spellbook client — required headers on every request (CAP-02 criterion 11)", () => {
  test("a GET carries the app-naming User-Agent and an Accept header", async () => {
    const { deps, calls } = makeHarness([ok200("{}")]);
    const client = createSpellbookClient(config, deps);

    await client.get("/variants/", { q: "x" });

    assert.deepEqual(calls[0]!.headers, {
      "User-Agent": USER_AGENT,
      "Accept": "application/json",
    });
    assert.ok(calls[0]!.headers["User-Agent"]!.includes("manabase-mtg/"));
  });

  test("a POST carries both, plus the JSON content type and the serialized body", async () => {
    const { deps, calls } = makeHarness([ok200("{}")]);
    const client = createSpellbookClient(config, deps);
    const deck = { main: [{ card: "Thassa's Oracle", quantity: 1 }], commanders: [] };

    await client.post("/find-my-combos", deck);

    assert.deepEqual(calls[0]!.headers, {
      "User-Agent": USER_AGENT,
      "Accept": "application/json",
      "Content-Type": "application/json",
    });
    assert.equal(calls[0]!.body, JSON.stringify(deck));
  });
});

describe("spellbook client — the field-error reader", () => {
  test("the verbatim 400 body returns bad_request with the upstream message intact", async () => {
    const { deps } = makeHarness([err(400, invalidQuery400)]);
    const client = createSpellbookClient(config, deps);

    const r = await client.get("/variants/", { q: "nonsenseop:foo" });

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "bad_request");
    assert.equal(r.error.status, 400);
    assert.equal(r.error.details, `q: ${UPSTREAM_MESSAGE}`);
    assert.ok(r.error.details.includes(UPSTREAM_MESSAGE)); // verbatim, not paraphrased
    assert.equal(r.error.message, "Commander Spellbook rejected the request as malformed.");
  });

  test("multiple messages on one field are joined", async () => {
    const { deps } = makeHarness([err(400, '{"q":["First problem.","Second problem."]}')]);
    const client = createSpellbookClient(config, deps);

    const r = await client.get("/variants/", { q: "x" });

    assert.ok(r.ok === false);
    assert.equal(r.error.details, "q: First problem. Second problem.");
  });

  test("multiple fields are flattened in body order", async () => {
    const { deps } = makeHarness([err(400, '{"q":["Bad query."],"limit":["Too large."]}')]);
    const client = createSpellbookClient(config, deps);

    const r = await client.get("/variants/", { q: "x" });

    assert.ok(r.ok === false);
    assert.equal(r.error.details, "q: Bad query.; limit: Too large.");
  });

  test("a bare string value is read as one message", async () => {
    const { deps } = makeHarness([err(404, '{"detail":"Not found."}')]);
    const client = createSpellbookClient(config, deps);

    const r = await client.get("/nope", {});

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "not_found");
    assert.equal(r.error.details, "detail: Not found.");
  });

  test("a body that is not a field-error map drops details and keeps the code", async () => {
    const { deps } = makeHarness([err(400, '{"count":0,"next":null,"results":[]}')]);
    const client = createSpellbookClient(config, deps);

    const r = await client.get("/variants/", { q: "x" });

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "bad_request");
    assert.ok(!("details" in r.error));
  });

  test("a JSON array body drops details and keeps the code", async () => {
    const { deps } = makeHarness([err(500, '["boom"]')]);
    const client = createSpellbookClient(config, deps);

    const r = await client.get("/variants/", { q: "x" });

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "upstream_unavailable");
    assert.ok(!("details" in r.error));
  });

  test("a body that is not JSON at all drops details and keeps the code", async () => {
    const { deps } = makeHarness([err(400, "<html>502 Bad Gateway</html>")]);
    const client = createSpellbookClient(config, deps);

    const r = await client.get("/variants/", { q: "x" });

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "bad_request");
    assert.ok(!("details" in r.error));
  });

  test("neither reader path throws — an empty object and an empty array both return cleanly", async () => {
    const { deps } = makeHarness([err(400, "{}"), err(400, '{"q":[]}')]);
    const client = createSpellbookClient(config, deps);

    const empty = await client.get("/variants/", { q: "x" });
    const emptyField = await client.get("/variants/", { q: "y" });

    assert.ok(empty.ok === false);
    assert.ok(!("details" in empty.error));
    assert.ok(emptyField.ok === false);
    assert.ok(!("details" in emptyField.error));
  });
});

describe("spellbook client — zero matches is a 200, never a 404", () => {
  test("an empty result set is a successful result, not a mapped failure", async () => {
    const { deps } = makeHarness([ok200(emptyResult)]);
    const client = createSpellbookClient(config, deps);

    const r = await client.get("/variants/", { q: 'card:"Zzzz Not A Real Card 9999"' });

    // (MCP-PRD §4.4) Commander Spellbook answers a valid query with no matches as HTTP 200
    // carrying `{"count":0,…,"results":[]}`. CAP-01's 404-as-empty mapping stays in `cardSearch`
    // and must never reach this transport.
    assert.ok(r.ok);
    assert.deepEqual(r.value, { count: 0, next: null, previous: null, results: [] });
  });

  test("a 404 from this host is a real not_found, because a bad path is what produces one", async () => {
    const { deps } = makeHarness([err(404, '{"detail":"Not found."}')]);
    const client = createSpellbookClient(config, deps);

    const r = await client.get("/variantz/", { q: "x" });

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "not_found");
    assert.equal(r.error.message, "Commander Spellbook found no match for the request.");
  });
});
