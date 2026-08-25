import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { Config } from "../../src/config.ts";
import { createHttpClient } from "../../src/http/client.ts";
import type { SourceSpec } from "../../src/http/client.ts";
import { createScryfallClient } from "../../src/scryfall/client.ts";
import { createSpellbookClient } from "../../src/spellbook/client.ts";

const USER_AGENT = "manabase-mtg/0.0.0 (+https://github.com/njohnb/manabase)";

const config: Config = {
  userAgent: USER_AGENT,
  cacheDir: "unused",
  scryfallBaseUrl: "https://scryfall.test",
  spellbookBaseUrl: "https://spellbook.test",
};

/** Scryfall's reader, inlined: this file tests the transport, not `src/scryfall/client.ts`. */
function scryfallDetails(text: string): string | undefined {
  try {
    const body = JSON.parse(text) as { details?: string };
    return typeof body.details === "string" ? body.details : undefined;
  } catch {
    return undefined;
  }
}

/** The shipped Scryfall lanes, restated as data so the message tests read `sourceName`. */
const scryfallSpec: SourceSpec = {
  sourceName: "Scryfall",
  baseUrl: "https://scryfall.test",
  userAgent: USER_AGENT,
  lanes: {
    card: {
      spacingMs: 500,
      pathPrefixes: ["/cards/search", "/cards/named", "/cards/random", "/cards/collection"],
    },
    other: { spacingMs: 100 },
  },
  defaultLane: "other",
  detailsFrom: scryfallDetails,
};

function specWith(overrides: Partial<SourceSpec>): SourceSpec {
  return { ...scryfallSpec, ...overrides };
}

const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

interface RecordedCall {
  url: string;
  at: number;
  headers: Record<string, string>;
  method: string | undefined;
  body: unknown;
}

/**
 * The virtual clock from tests/scryfall/client.test.ts, extended to record the whole
 * `RequestInit` — `method` and `body` are what the POST criteria read. `sleep` advances `clock`
 * instead of waiting, so a 30-second backoff test costs no real time.
 */
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

/** One clock and one call log shared by every client built from it. Always answers 200 `{}`. */
function makeSharedHarness() {
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
      return Promise.resolve(new Response("{}", { status: 200 }));
    }) as typeof fetch,
  };
  const forHost = (host: string) => calls.filter((c) => c.url.startsWith(host));
  return { deps, sleeps, calls, forHost };
}

describe("http client — the eight message templates at sourceName Scryfall", () => {
  test("persisted 429 — the rate-limit sentence", async () => {
    const { deps } = makeHarness([jsonResponse(429, {}), jsonResponse(429, {})]);
    const client = createHttpClient(scryfallSpec, deps);

    const r = await client.get("/cards/search", { q: "x" });

    assert.ok(r.ok === false);
    assert.equal(
      r.error.message,
      "Scryfall rate limit persisted after a 30 second backoff; wait at least 30 seconds before retrying.",
    );
  });

  test("non-JSON success body names the status", async () => {
    const { deps } = makeHarness([new Response("<html>maintenance</html>", { status: 200 })]);
    const client = createHttpClient(scryfallSpec, deps);

    const r = await client.get("/sets");

    assert.ok(r.ok === false);
    assert.equal(r.error.message, "Scryfall returned a non-JSON success body (status 200).");
  });

  test("400 — malformed", async () => {
    const { deps } = makeHarness([jsonResponse(400, {})]);
    const client = createHttpClient(scryfallSpec, deps);

    const r = await client.get("/cards/search", { q: "" });

    assert.ok(r.ok === false);
    assert.equal(r.error.message, "Scryfall rejected the request as malformed.");
  });

  test("404 — no match", async () => {
    const { deps } = makeHarness([jsonResponse(404, {})]);
    const client = createHttpClient(scryfallSpec, deps);

    const r = await client.get("/cards/named", { exact: "Not A Real Card" });

    assert.ok(r.ok === false);
    assert.equal(r.error.message, "Scryfall found no match for the request.");
  });

  test("500 — unavailable", async () => {
    const { deps } = makeHarness([jsonResponse(500, {})]);
    const client = createHttpClient(scryfallSpec, deps);

    const r = await client.get("/sets");

    assert.ok(r.ok === false);
    assert.equal(r.error.message, "Scryfall is currently unavailable.");
  });

  test("an unmapped status names itself", async () => {
    const { deps } = makeHarness([new Response("", { status: 418 })]);
    const client = createHttpClient(scryfallSpec, deps);

    const r = await client.get("/sets");

    assert.ok(r.ok === false);
    assert.equal(r.error.message, "Scryfall returned an unexpected status 418.");
  });

  // The two that do not begin with the source name — the two a careless template breaks.
  test("a fetch rejection reads 'Could not reach Scryfall: …'", async () => {
    const { deps } = makeHarness([new Error("getaddrinfo ENOTFOUND api.scryfall.com")]);
    const client = createHttpClient(scryfallSpec, deps);

    const r = await client.get("/sets");

    assert.ok(r.ok === false);
    assert.equal(r.error.message, "Could not reach Scryfall: getaddrinfo ENOTFOUND api.scryfall.com");
  });

  test("the D-10 backstop reads 'Unexpected failure in Scryfall client: …'", async () => {
    const deps = {
      now: () => { throw new Error("clock exploded"); },
      sleep: (_ms: number) => Promise.resolve(),
      fetchImpl: (() => Promise.resolve(jsonResponse(200, {}))) as typeof fetch,
    };
    const client = createHttpClient(scryfallSpec, deps);

    const r = await client.get("/sets");

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "unexpected");
    assert.equal(r.error.message, "Unexpected failure in Scryfall client: clock exploded");
  });
});

describe("http client — lane selection is by prefix, never by identity", () => {
  test("all four card prefixes take the 500ms lane", async () => {
    const { deps, sleeps, calls } = makeHarness([
      jsonResponse(200, {}),
      jsonResponse(200, {}),
      jsonResponse(200, {}),
      jsonResponse(200, {}),
    ]);
    const client = createHttpClient(scryfallSpec, deps);

    await Promise.all([
      client.get("/cards/search", { q: "a" }),
      client.get("/cards/named", { exact: "b" }),
      client.get("/cards/random"),
      client.get("/cards/collection"),
    ]);

    assert.deepEqual(sleeps, [500, 500, 500]);
    assert.deepEqual(calls.map((c) => c.at), [0, 500, 1000, 1500]);
  });

  test("a path no lane claims takes the default lane's spacing", async () => {
    const { deps, sleeps } = makeHarness([jsonResponse(200, {}), jsonResponse(200, {})]);
    const client = createHttpClient(scryfallSpec, deps);

    await Promise.all([client.get("/sets"), client.get("/symbology")]);

    assert.deepEqual(sleeps, [100]);
  });

  test("a single-lane spec routes every path to its default", async () => {
    const spec = specWith({
      sourceName: "One Lane",
      lanes: { only: { spacingMs: 250 } },
      defaultLane: "only",
    });
    const { deps, sleeps, calls } = makeHarness([jsonResponse(200, {}), jsonResponse(200, {})]);
    const client = createHttpClient(spec, deps);

    await Promise.all([client.get("/cards/search", { q: "a" }), client.get("/sets")]);

    assert.deepEqual(sleeps, [250]);
    assert.equal(calls[1]!.at - calls[0]!.at, 250);
  });

  test("the first matching prefix in declaration order wins, not the most specific", async () => {
    const spec = specWith({
      sourceName: "Ordered",
      lanes: {
        broad: { spacingMs: 700, pathPrefixes: ["/cards"] },
        narrow: { spacingMs: 50, pathPrefixes: ["/cards/search"] },
      },
      defaultLane: "narrow",
    });
    const { deps, sleeps } = makeHarness([jsonResponse(200, {}), jsonResponse(200, {})]);
    const client = createHttpClient(spec, deps);

    await Promise.all([client.get("/cards/search", { q: "a" }), client.get("/cards/random")]);

    assert.deepEqual(sleeps, [700]);
  });

  test("a defaultLane naming no lane fails at construction, not at request time", () => {
    const spec = specWith({ defaultLane: "nonexistent" });

    assert.throws(() => createHttpClient(spec), /defaultLane "nonexistent" is not a key of lanes/);
  });
});

describe("http client — the POST verb", () => {
  test("POST carries the method, the JSON content type, and the serialized body", async () => {
    const { deps, calls } = makeHarness([jsonResponse(200, { object: "list" })]);
    const client = createHttpClient(scryfallSpec, deps);
    const body = { identifiers: [{ name: "Thassa's Oracle" }] };

    const r = await client.post("/cards/collection", body);

    assert.ok(r.ok);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "POST");
    assert.equal(calls[0]!.body, JSON.stringify(body));
    assert.deepEqual(calls[0]!.headers, {
      "User-Agent": USER_AGENT,
      "Accept": "application/json",
      "Content-Type": "application/json",
    });
  });

  test("GET carries the two required headers and no method", async () => {
    const { deps, calls } = makeHarness([jsonResponse(200, {})]);
    const client = createHttpClient(scryfallSpec, deps);

    await client.get("/sets");

    assert.equal(calls[0]!.method, undefined);
    assert.equal(calls[0]!.body, undefined);
    assert.deepEqual(calls[0]!.headers, {
      "User-Agent": USER_AGENT,
      "Accept": "application/json",
    });
  });

  test("POST rides the same lane as GET — a POST that skips the queue is not rate-limited", async () => {
    const { deps, sleeps, calls } = makeHarness([jsonResponse(200, {}), jsonResponse(200, {})]);
    const client = createHttpClient(scryfallSpec, deps);

    await Promise.all([
      client.get("/cards/search", { q: "a" }),
      client.post("/cards/collection", { identifiers: [] }),
    ]);

    assert.deepEqual(sleeps, [500]);
    assert.equal(calls[1]!.at - calls[0]!.at, 500);
  });

  test("POST assembles query params the same way GET does", async () => {
    const { deps, calls } = makeHarness([jsonResponse(200, {})]);
    const client = createHttpClient(scryfallSpec, deps);

    await client.post("/find-my-combos", { main: [] }, { limit: "40", offset: undefined });

    assert.equal(calls[0]!.url, "https://scryfall.test/find-my-combos?limit=40");
  });

  test("a body that cannot be serialized is caught by the backstop, never thrown", async () => {
    const { deps, calls } = makeHarness([jsonResponse(200, {})]);
    const client = createHttpClient(scryfallSpec, deps);
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const r = await client.post("/cards/collection", circular);

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "unexpected");
    assert.match(r.error.message, /^Unexpected failure in Scryfall client: /);
    assert.equal(calls.length, 0); // never reached the network
  });
});

describe("http client — 429 backoff on the generic factory", () => {
  test("429 then 200 succeeds after a 30s backoff, no immediate retry", async () => {
    const { deps, sleeps, calls } = makeHarness([jsonResponse(429, {}), jsonResponse(200, { ok: true })]);
    const client = createHttpClient(scryfallSpec, deps);

    const r = await client.get("/cards/named", { exact: "Lightning Bolt" });

    assert.ok(r.ok);
    assert.deepEqual(sleeps, [30000]);
    assert.equal(calls.length, 2);
    assert.equal(calls[1]!.at - calls[0]!.at, 30000);
    assert.equal(calls[1]!.url, calls[0]!.url);
  });

  test("nextAllowedAt is restamped after the retry — sleeps read [30000, 500]", async () => {
    const { deps, sleeps, calls } = makeHarness([
      jsonResponse(429, {}),
      jsonResponse(200, {}),
      jsonResponse(200, {}),
    ]);
    const client = createHttpClient(scryfallSpec, deps);

    await Promise.all([
      client.get("/cards/named", { exact: "a" }),
      client.get("/cards/named", { exact: "b" }),
    ]);

    assert.deepEqual(sleeps, [30000, 500]);
    assert.equal(calls[2]!.at - calls[1]!.at, 500);
  });

  test("429 then 429 returns rate_limited without a second retry", async () => {
    const { deps, sleeps, calls } = makeHarness([jsonResponse(429, {}), jsonResponse(429, {})]);
    const client = createHttpClient(scryfallSpec, deps);

    const r = await client.get("/cards/random");

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "rate_limited");
    assert.equal(r.error.status, 429);
    assert.deepEqual(sleeps, [30000]);
    assert.equal(calls.length, 2);
  });

  test("a persisted 429 keeps the source's own details verbatim", async () => {
    const { deps } = makeHarness([
      jsonResponse(429, {}),
      jsonResponse(429, { details: "You have been rate limited. Please wait." }),
    ]);
    const client = createHttpClient(scryfallSpec, deps);

    const r = await client.get("/cards/search", { q: "x" });

    assert.ok(r.ok === false);
    assert.equal(r.error.details, "You have been rate limited. Please wait.");
  });

  test("a persisted 429 locks the lane for 30s — a queued request waits it out", async () => {
    const { deps, sleeps, calls } = makeHarness([
      jsonResponse(429, {}),
      jsonResponse(429, {}),
      jsonResponse(200, {}),
    ]);
    const client = createHttpClient(scryfallSpec, deps);

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

  test("a POST is throttled by the same 429 machinery as a GET", async () => {
    const { deps, sleeps, calls } = makeHarness([jsonResponse(429, {}), jsonResponse(200, { ok: true })]);
    const client = createHttpClient(scryfallSpec, deps);

    const r = await client.post("/cards/collection", { identifiers: [] });

    assert.ok(r.ok);
    assert.deepEqual(sleeps, [30000]);
    assert.equal(calls.length, 2);
    assert.equal(calls[1]!.method, "POST");
  });
});

describe("http client — url assembly and the backstop", () => {
  test("no '?' without params", async () => {
    const { deps, calls } = makeHarness([jsonResponse(200, {})]);
    const client = createHttpClient(scryfallSpec, deps);

    await client.get("/sets");

    assert.equal(calls[0]!.url, "https://scryfall.test/sets");
  });

  test("query params are url-encoded and undefined values are skipped", async () => {
    const { deps, calls } = makeHarness([jsonResponse(200, {})]);
    const client = createHttpClient(scryfallSpec, deps);

    await client.get("/cards/search", { q: "o:flying t:bird", unique: "cards", page: undefined });

    assert.equal(
      calls[0]!.url,
      "https://scryfall.test/cards/search?q=o%3Aflying+t%3Abird&unique=cards",
    );
  });

  test("an all-undefined query produces no '?'", async () => {
    const { deps, calls } = makeHarness([jsonResponse(200, {})]);
    const client = createHttpClient(scryfallSpec, deps);

    await client.get("/sets", { foo: undefined });

    assert.equal(calls[0]!.url, "https://scryfall.test/sets");
  });

  test("fetchImpl resolving undefined is caught by the backstop, never throws", async () => {
    const deps = {
      now: () => 0,
      sleep: (_ms: number) => Promise.resolve(),
      fetchImpl: (() => Promise.resolve(undefined)) as unknown as typeof fetch,
    };
    const client = createHttpClient(scryfallSpec, deps);

    const r = await client.get("/sets");

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "unexpected");
  });
});

describe("http client — two sources on one clock do not interfere", () => {
  test("a Commander Spellbook request neither delays nor is delayed by a Scryfall card call", async () => {
    const { deps, sleeps, forHost } = makeSharedHarness();
    const scryfall = createScryfallClient(config, deps);
    const spellbook = createSpellbookClient(config, deps);

    await Promise.all([
      spellbook.get("/variants/", { q: 'card:"Thassa\'s Oracle"' }),
      scryfall.get("/cards/search", { q: "t:bird" }),
      spellbook.get("/variants/", { offset: "40" }),
    ]);

    const sb = forHost("https://spellbook.test");
    const sf = forHost("https://scryfall.test");
    assert.equal(sb.length, 2);
    assert.equal(sf.length, 1);
    // Only Commander Spellbook's own second request ever waits.
    assert.deepEqual(sleeps, [500]);
    assert.equal(sb[1]!.at - sb[0]!.at, 500);
    assert.equal(sf[0]!.at, 0);
  });

  test("control: the same two Spellbook requests alone keep the same timings", async () => {
    const { deps, sleeps, forHost } = makeSharedHarness();
    const spellbook = createSpellbookClient(config, deps);

    await Promise.all([
      spellbook.get("/variants/", { q: 'card:"Thassa\'s Oracle"' }),
      spellbook.get("/variants/", { offset: "40" }),
    ]);

    const sb = forHost("https://spellbook.test");
    assert.deepEqual(sleeps, [500]);
    assert.equal(sb[1]!.at - sb[0]!.at, 500);
  });

  test("sequential calls to the two hosts never sleep", async () => {
    const { deps, sleeps } = makeSharedHarness();
    const scryfall = createScryfallClient(config, deps);
    const spellbook = createSpellbookClient(config, deps);

    await spellbook.get("/variants/", { q: "x" });
    await scryfall.get("/cards/search", { q: "y" });

    assert.deepEqual(sleeps, []);
  });
});

describe("http client — the shipped Scryfall spec", () => {
  test("createScryfallClient names itself Scryfall in its messages", async () => {
    const { deps } = makeHarness([jsonResponse(400, { details: "All of your terms were ignored." })]);
    const client = createScryfallClient(config, deps);

    const r = await client.get("/cards/search", { q: "" });

    assert.ok(r.ok === false);
    assert.equal(r.error.message, "Scryfall rejected the request as malformed.");
    assert.equal(r.error.details, "All of your terms were ignored.");
  });
});
