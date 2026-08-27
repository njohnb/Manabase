import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Result } from "../../src/result.ts";
import type { HttpClient } from "../../src/http/client.ts";
import { resolveNames } from "../../src/scryfall/collection.ts";

// Loaded at runtime, like every other suite here: no `resolveJsonModule`, and identical behaviour
// under type stripping and under the esbuild bundle.
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
}

/** Verbatim Scryfall `POST /cards/collection`, captured 2026-08-24 (MCP-PRD §4.4 probe 4). */
const collectionNotFound = fixture("collection-not-found.json");

interface PostCall {
  path: string;
  identifiers: Array<{ name: string }>;
}

function identifiersOf(body: unknown): Array<{ name: string }> {
  return (body as { identifiers: Array<{ name: string }> }).identifiers;
}

const refuseGet = (path: string): Promise<never> =>
  Promise.reject(new Error(`fake client: resolveNames must not GET (${path})`));

/**
 * Echoes every submitted identifier back as found.
 *
 * Building the reply FROM the request is what makes the batching assertions mean something: a
 * client that returned a canned body would pass whether the walk submitted every name once, some
 * names twice, or the same 75 repeatedly.
 */
function echoingClient(): { client: HttpClient; calls: PostCall[] } {
  const calls: PostCall[] = [];
  const client: HttpClient = {
    get: refuseGet,
    post(path, body) {
      const identifiers = identifiersOf(body);
      calls.push({ path, identifiers });
      return Promise.resolve({
        ok: true,
        value: { object: "list", not_found: [], data: identifiers.map(({ name }) => ({ name })) },
      });
    },
  };
  return { client, calls };
}

/**
 * A queue of canned replies. An unscripted call REJECTS rather than returning something plausible —
 * several tests here assert that the walk STOPPED, and a lenient fake makes that vacuous.
 */
function scriptedClient(script: Array<Result<unknown>>): { client: HttpClient; calls: PostCall[] } {
  const queue = [...script];
  const calls: PostCall[] = [];
  const client: HttpClient = {
    get: refuseGet,
    post(path, body) {
      calls.push({ path, identifiers: identifiersOf(body) });
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

const names = (n: number): string[] => Array.from({ length: n }, (_, i) => `Card ${i + 1}`);

describe("resolveNames — batching at 75", () => {
  // MCP-PRD §4.1.2: maximum 75 card references per request, and never a loop over /cards/named.
  // The 100-name row is the figure the PRD quotes: a 100-card decklist is 2 requests, ~1 second.
  const cases: Array<[number, number]> = [
    [1, 1],
    [74, 1],
    [75, 1],
    [76, 2],
    [100, 2],
    [150, 2],
    [151, 3],
  ];

  for (const [count, expected] of cases) {
    test(`[Slice 17 #10] ${count} names is ${expected} request${expected === 1 ? "" : "s"}`, async () => {
      const { client, calls } = echoingClient();

      const result = await resolveNames(client, names(count));

      assert.equal(result.ok, true);
      assert.equal(calls.length, expected);
      for (const call of calls) {
        assert.equal(call.path, "/cards/collection");
        assert.ok(call.identifiers.length <= 75, `batch of ${call.identifiers.length} exceeds 75`);
      }
    });
  }

  test("[requirement 1] every submitted name is sent exactly once, in order", async () => {
    const { client, calls } = echoingClient();
    const submitted = names(100);

    const result = await resolveNames(client, submitted);

    assert.equal(result.ok, true);
    assert.equal(calls[0]!.identifiers.length, 75);
    assert.equal(calls[1]!.identifiers.length, 25);
    const sent = calls.flatMap((call) => call.identifiers.map((identifier) => identifier.name));
    assert.deepEqual(sent, submitted);
    // Identifier OBJECTS keyed by `name`, never bare strings.
    assert.deepEqual(calls[0]!.identifiers[0], { name: "Card 1" });
  });

  test("an empty name list issues no request at all", async () => {
    const { client, calls } = echoingClient();

    const result = await resolveNames(client, []);

    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.value, { resolved: [], unresolved: [] });
    assert.equal(calls.length, 0);
  });
});

describe("resolveNames — not_found is the whole point", () => {
  test("[CAP-02 #5] a miss is read out of not_found as the identifier object submitted", async () => {
    // The verbatim capture: three names, one invented, `not_found` carrying `{"name":"Zzzz ..."}`
    // rather than a bare string. This is the ONLY mechanism by which a caller learns a submitted
    // name matched nothing — Commander Spellbook will never say so (MCP-PRD §4.4).
    const { client } = scriptedClient([{ ok: true, value: collectionNotFound }]);

    const result = await resolveNames(client, [
      "Demonic Consultation",
      "Thassa's Oracle",
      "Zzzz Not A Real Card 9999",
    ]);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value.unresolved, ["Zzzz Not A Real Card 9999"]);
    assert.deepEqual(result.value.resolved, ["Demonic Consultation", "Thassa's Oracle"]);
  });

  test("an empty not_found means every name resolved", async () => {
    const { client } = echoingClient();

    const result = await resolveNames(client, ["Sol Ring", "Arcane Signet"]);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value.unresolved, []);
    assert.deepEqual(result.value.resolved, ["Sol Ring", "Arcane Signet"]);
  });

  test("misses accumulate across batches", async () => {
    const { client } = scriptedClient([
      { ok: true, value: { object: "list", not_found: [{ name: "Fake One" }], data: [] } },
      { ok: true, value: { object: "list", not_found: [{ name: "Fake Two" }], data: [] } },
    ]);

    const result = await resolveNames(client, names(100));

    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.value.unresolved, ["Fake One", "Fake Two"]);
  });

  test("a not_found entry carrying no name is skipped rather than guessed at", async () => {
    // A shape this endpoint has never produced: only `{ name }` identifiers go up, and Scryfall
    // echoes the identifier it could not match. `not_found` carries no index back to the submitted
    // list, so there is nothing to fall back to that would not be an invention.
    const { client } = scriptedClient([
      { ok: true, value: { object: "list", not_found: [{}, { name: "Fake" }, null], data: [] } },
    ]);

    const result = await resolveNames(client, ["a", "b", "c"]);

    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.value.unresolved, ["Fake"]);
  });
});

describe("resolveNames — failures", () => {
  test("[requirement 4] a failing batch returns that Failure and stops the walk", async () => {
    const failure: Result<unknown> = {
      ok: false,
      error: { code: "upstream_unavailable", message: "Scryfall is currently unavailable.", status: 503 },
    };
    const { client, calls } = scriptedClient([failure]);

    const result = await resolveNames(client, names(150));

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "upstream_unavailable");
    assert.equal(result.error.status, 503);
    // Stopped on the first batch: the second was never attempted, which the script proves by
    // rejecting if it had been.
    assert.equal(calls.length, 1);
  });

  test("[requirement 4] a LATER batch failing also propagates, unchanged", async () => {
    const failure: Result<unknown> = {
      ok: false,
      error: { code: "rate_limited", message: "…", status: 429 },
    };
    const { client, calls } = scriptedClient([
      { ok: true, value: { object: "list", not_found: [], data: [] } },
      failure,
    ]);

    const result = await resolveNames(client, names(100));

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, "rate_limited");
    assert.equal(calls.length, 2);
  });

  test("a body that is not a collection is a structured unexpected, not a throw", async () => {
    const bodies: unknown[] = [
      null,
      "a string",
      42,
      {},
      { data: [], not_found: "nope" },
      { data: "nope", not_found: [] },
    ];

    for (const value of bodies) {
      const { client } = scriptedClient([{ ok: true, value }]);

      const result = await resolveNames(client, ["Sol Ring"]);

      assert.equal(result.ok, false, JSON.stringify(value));
      assert.equal(!result.ok && result.error.code, "unexpected", JSON.stringify(value));
    }
  });

  test("[D-10] a rejecting client surfaces as a rejection, not a silent success", async () => {
    // resolveNames has no try/catch of its own: the shared HttpClient already guards every call
    // (`guarded` in src/http/client.ts), so a rejecting FAKE is a fake, not a real failure mode.
    // Asserted so nobody adds a backstop here believing one is missing.
    const client: HttpClient = {
      get: refuseGet,
      post: () => Promise.reject(new Error("boom")),
    };

    await assert.rejects(resolveNames(client, ["Sol Ring"]), /boom/);
  });
});
