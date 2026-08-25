import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { Config } from "../../src/config.ts";
import { createScryfallClient } from "../../src/scryfall/client.ts";

const config: Config = {
  userAgent: "manabase-mtg/0.0.0 (+https://github.com/njohnb/manabase)",
  cacheDir: "unused",
  scryfallBaseUrl: "https://scryfall.test",
  spellbookBaseUrl: "https://spellbook.test",
};

const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function makeHarness(script: Array<Response | Error>) {
  let clock = 0;
  const sleeps: number[] = [];
  const calls: Array<{ url: string; at: number; headers: Record<string, string> }> = [];
  const deps = {
    now: () => clock,
    sleep: (ms: number) => { sleeps.push(ms); clock += ms; return Promise.resolve(); },
    fetchImpl: ((input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), at: clock, headers: { ...(init?.headers as Record<string, string>) } });
      const next = script.shift();
      if (next === undefined) return Promise.reject(new Error("mock fetch: script exhausted"));
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    }) as typeof fetch,
  };
  return { deps, sleeps, calls };
}

describe("scryfall client — headers and url assembly", () => {
  test("200 captures required headers and no '?' without params", async () => {
    const body = { object: "list", data: [] };
    const { deps, calls } = makeHarness([jsonResponse(200, body)]);
    const client = createScryfallClient(config, deps);

    const r = await client.get("/sets");

    assert.ok(r.ok);
    assert.deepEqual(r.value, body);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.headers["User-Agent"], config.userAgent);
    assert.ok(calls[0]!.headers["User-Agent"]!.includes("manabase-mtg/"));
    assert.equal(calls[0]!.headers["Accept"], "application/json");
    assert.equal(calls[0]!.url, "https://scryfall.test/sets");
    assert.ok(!calls[0]!.url.includes("?"));
  });

  test("query params are url-encoded and undefined values are skipped", async () => {
    const { deps, calls } = makeHarness([jsonResponse(200, {})]);
    const client = createScryfallClient(config, deps);

    await client.get("/cards/search", { q: "o:flying t:bird", unique: "cards", page: undefined });

    assert.equal(
      calls[0]!.url,
      "https://scryfall.test/cards/search?q=o%3Aflying+t%3Abird&unique=cards",
    );
  });

  test("all-undefined query produces no '?' in the url", async () => {
    const { deps, calls } = makeHarness([jsonResponse(200, {})]);
    const client = createScryfallClient(config, deps);

    await client.get("/sets", { foo: undefined });

    assert.equal(calls[0]!.url, "https://scryfall.test/sets");
  });
});

describe("scryfall client — rate limiting", () => {
  test("two concurrent card calls are spaced 500ms apart", async () => {
    const { deps, sleeps, calls } = makeHarness([jsonResponse(200, {}), jsonResponse(200, {})]);
    const client = createScryfallClient(config, deps);

    await Promise.all([client.get("/cards/search", { q: "a" }), client.get("/cards/named", { exact: "b" })]);

    assert.deepEqual(sleeps, [500]);
    assert.equal(calls[1]!.at - calls[0]!.at, 500);
  });

  test("two concurrent non-card calls are spaced 100ms apart", async () => {
    const { deps, sleeps, calls } = makeHarness([jsonResponse(200, {}), jsonResponse(200, {})]);
    const client = createScryfallClient(config, deps);

    await Promise.all([client.get("/sets"), client.get("/symbology")]);

    assert.deepEqual(sleeps, [100]);
    assert.equal(calls[1]!.at - calls[0]!.at, 100);
  });

  test("card and non-card lanes are independent — sequential calls never sleep", async () => {
    const { deps, sleeps } = makeHarness([jsonResponse(200, {}), jsonResponse(200, {})]);
    const client = createScryfallClient(config, deps);

    await client.get("/cards/search", { q: "a" });
    await client.get("/sets");

    assert.deepEqual(sleeps, []);
  });

  test("mixed concurrent card + non-card calls: per-lane fetch deltas hold", async () => {
    const { deps, calls } = makeHarness([
      jsonResponse(200, {}),
      jsonResponse(200, {}),
      jsonResponse(200, {}),
      jsonResponse(200, {}),
    ]);
    const client = createScryfallClient(config, deps);

    await Promise.all([
      client.get("/cards/search", { q: "a" }),
      client.get("/sets"),
      client.get("/cards/named", { exact: "b" }),
      client.get("/symbology"),
    ]);

    const cardCalls = calls.filter((c) => c.url.includes("/cards/"));
    const otherCalls = calls.filter((c) => !c.url.includes("/cards/"));
    assert.equal(cardCalls.length, 2);
    assert.equal(otherCalls.length, 2);
    assert.ok(cardCalls[1]!.at - cardCalls[0]!.at >= 500);
    assert.ok(otherCalls[1]!.at - otherCalls[0]!.at >= 100);
    // Each lane's first request fires immediately — a merged single lane would delay
    // the first non-card call behind the card call's 500ms spacing.
    assert.equal(cardCalls[0]!.at, 0);
    assert.equal(otherCalls[0]!.at, 0);
  });

  test("cards/random and /cards/collection share the 500ms card lane", async () => {
    const { deps, sleeps, calls } = makeHarness([jsonResponse(200, {}), jsonResponse(200, {})]);
    const client = createScryfallClient(config, deps);

    await Promise.all([client.get("/cards/random"), client.get("/cards/collection")]);

    assert.deepEqual(sleeps, [500]);
    assert.equal(calls[1]!.at - calls[0]!.at, 500);
  });
});

describe("scryfall client — 429 backoff", () => {
  test("429 then 200 succeeds after a 30s backoff, no immediate retry", async () => {
    const { deps, sleeps, calls } = makeHarness([jsonResponse(429, {}), jsonResponse(200, { ok: true })]);
    const client = createScryfallClient(config, deps);

    const r = await client.get("/cards/named", { exact: "Lightning Bolt" });

    assert.ok(r.ok);
    assert.deepEqual(sleeps, [30000]);
    assert.equal(calls.length, 2);
    assert.equal(calls[1]!.at - calls[0]!.at, 30000);
    assert.equal(calls[1]!.url, calls[0]!.url);
    assert.equal(calls[1]!.headers["User-Agent"], config.userAgent);
    assert.equal(calls[1]!.headers["Accept"], "application/json");
  });

  test("nextAllowedAt is restamped after the retry (spacing relative to retry, not original)", async () => {
    const { deps, sleeps, calls } = makeHarness([
      jsonResponse(429, {}),
      jsonResponse(200, {}),
      jsonResponse(200, {}),
    ]);
    const client = createScryfallClient(config, deps);

    await Promise.all([
      client.get("/cards/named", { exact: "a" }),
      client.get("/cards/named", { exact: "b" }),
    ]);

    assert.deepEqual(sleeps, [30000, 500]);
    assert.equal(calls[2]!.at - calls[1]!.at, 500);
  });

  test("429 then 429 returns rate_limited without a second retry", async () => {
    const { deps, sleeps, calls } = makeHarness([jsonResponse(429, {}), jsonResponse(429, {})]);
    const client = createScryfallClient(config, deps);

    const r = await client.get("/cards/random");

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "rate_limited");
    assert.match(r.error.message, /wait/i);
    assert.equal(r.error.status, 429);
    assert.ok(!("details" in r.error));
    assert.deepEqual(sleeps, [30000]);
    assert.equal(calls.length, 2);
  });

  test("persisted 429 preserves the response body's details verbatim", async () => {
    const { deps } = makeHarness([
      jsonResponse(429, {}),
      jsonResponse(429, {
        object: "error",
        code: "rate_limited",
        status: 429,
        details: "You have been rate limited. Please wait.",
      }),
    ]);
    const client = createScryfallClient(config, deps);

    const r = await client.get("/cards/search", { q: "x" });

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "rate_limited");
    assert.equal(r.error.details, "You have been rate limited. Please wait.");
  });

  test("persisted 429 locks the lane for 30s — a queued request waits out the lockout", async () => {
    const { deps, sleeps, calls } = makeHarness([
      jsonResponse(429, {}),
      jsonResponse(429, {}),
      jsonResponse(200, {}),
    ]);
    const client = createScryfallClient(config, deps);

    const [r1, r2] = await Promise.all([
      client.get("/cards/named", { exact: "a" }),
      client.get("/cards/named", { exact: "b" }),
    ]);

    assert.ok(r1.ok === false);
    assert.equal(r1.error.code, "rate_limited");
    assert.ok(r2.ok);
    assert.deepEqual(sleeps, [30000, 30000]);
    assert.equal(calls[2]!.at - calls[1]!.at, 30000);
  });
});

describe("scryfall client — status mapping", () => {
  test("400 with Scryfall error body maps to bad_request with verbatim details", async () => {
    const { deps } = makeHarness([
      jsonResponse(400, {
        object: "error",
        code: "bad_request",
        status: 400,
        details: "All of your terms were ignored.",
      }),
    ]);
    const client = createScryfallClient(config, deps);

    const r = await client.get("/cards/search", { q: "" });

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "bad_request");
    assert.equal(r.error.details, "All of your terms were ignored.");
    assert.equal(r.error.status, 400);
    assert.ok(r.error.message.length > 0);
  });

  test("400 with unparseable body maps to bad_request with no details", async () => {
    const { deps } = makeHarness([new Response("oops", { status: 400 })]);
    const client = createScryfallClient(config, deps);

    const r = await client.get("/cards/search", { q: "" });

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "bad_request");
    assert.ok(!("details" in r.error));
    assert.ok(r.error.message.length > 0);
  });

  test("404 with error body maps to not_found with verbatim details", async () => {
    const { deps } = makeHarness([
      jsonResponse(404, {
        object: "error",
        code: "not_found",
        status: 404,
        details: "No cards found matching that name.",
      }),
    ]);
    const client = createScryfallClient(config, deps);

    const r = await client.get("/cards/named", { exact: "Not A Real Card" });

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "not_found");
    assert.equal(r.error.details, "No cards found matching that name.");
  });

  test("500 maps to upstream_unavailable", async () => {
    const { deps } = makeHarness([jsonResponse(500, { object: "error", status: 500 })]);
    const client = createScryfallClient(config, deps);

    const r = await client.get("/sets");

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "upstream_unavailable");
    assert.equal(r.error.status, 500);
  });

  test("fetch rejection maps to network with no status", async () => {
    const { deps } = makeHarness([new Error("getaddrinfo ENOTFOUND api.scryfall.com")]);
    const client = createScryfallClient(config, deps);

    const r = await client.get("/sets");

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "network");
    assert.ok(!("status" in r.error));
  });

  test("200 with non-JSON body maps to unexpected", async () => {
    const { deps } = makeHarness([new Response("<html>maintenance</html>", { status: 200 })]);
    const client = createScryfallClient(config, deps);

    const r = await client.get("/sets");

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "unexpected");
    assert.equal(r.error.status, 200);
  });

  test("418 maps to unexpected", async () => {
    const { deps } = makeHarness([new Response("", { status: 418 })]);
    const client = createScryfallClient(config, deps);

    const r = await client.get("/sets");

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "unexpected");
    assert.equal(r.error.status, 418);
  });

  test("fetchImpl resolving undefined is caught by the backstop, never throws", async () => {
    const deps = {
      now: () => 0,
      sleep: (_ms: number) => Promise.resolve(),
      fetchImpl: (() => Promise.resolve(undefined)) as unknown as typeof fetch,
    };
    const client = createScryfallClient(config, deps);

    const r = await client.get("/sets");

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "unexpected");
  });
});
