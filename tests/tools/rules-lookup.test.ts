import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { HttpClient } from "../../src/http/client.ts";
import type { RulesFs, RulesStoreDeps } from "../../src/rules/store.ts";
import { rulesLookup } from "../../src/tools/rules-lookup.ts";
import { SYNTHETIC_LINES, syntheticCr } from "../rules/synthetic-cr.ts";

const MEDIA = "https://media.wizards.com";
const DAY = 86_400_000;
const DOWNLOADED_AT = Date.parse("2026-11-10T00:00:00Z");

const LANDING =
  `<a href="${MEDIA}/2026/downloads/MagicCompRules 20261106.pdf">pdf</a>` +
  `<a href="${MEDIA}/2026/downloads/MagicCompRules 20261106.txt">txt</a>`;

function textClient(body: string, log: string[]): HttpClient {
  return {
    get(path) { log.push(path); return Promise.resolve({ ok: true, value: body }); },
    post: () => Promise.reject(new Error("no POST to Wizards")),
  };
}

function memoryFs(): RulesFs {
  const files = new Map<string, string>();
  return {
    readText: (path) => Promise.resolve(files.get(path)),
    writeText: (path, text) => { files.set(path, text); return Promise.resolve(); },
    remove: (path) => { files.delete(path); return Promise.resolve(); },
  };
}

/** One disk shared across calls; the clock is settable so the cache can age between calls. */
function harness(cr = syntheticCr()) {
  const requests: string[] = [];
  let clock = DOWNLOADED_AT;
  const deps: RulesStoreDeps = {
    site: textClient(LANDING, requests),
    media: textClient(cr, requests),
    siteBaseUrl: "https://magic.wizards.com",
    mediaBaseUrl: MEDIA,
    fs: memoryFs(),
    now: () => clock,
    cacheDir: "cache-root",
  };
  return { deps, requests, setNow: (ms: number) => { clock = ms; } };
}

describe("rulesLookup — rule 702.19", () => {
  test("returns the rule, its subrules, the CR effective date, the cache age and the PDF citation", async () => {
    const { deps } = harness();

    const r = await rulesLookup(deps, { rule: "702.19" });

    assert.ok(r.ok, r.ok ? "" : r.error.message);
    assert.deepEqual(r.value.rules.map((e) => e.number), ["702.19", "702.19a", "702.19b", "702.19c"]);
    assert.equal(r.value.cr_effective_date, "2026-11-06");
    assert.equal(r.value.citation_url, `${MEDIA}/2026/downloads/MagicCompRules%2020261106.pdf`);
    assert.equal(r.value.fetched_at, "2026-11-10T00:00:00.000Z");
    assert.equal(r.value.cache_age_days, 0);
    assert.equal(r.value.truncated, false);
  });

  test("a later call is served from the cache with no request, and reports its age", async () => {
    const { deps, requests, setNow } = harness();
    await rulesLookup(deps, { rule: "702.19" });
    const firstUse = requests.length;

    setNow(DOWNLOADED_AT + 3 * DAY + 5);
    const r = await rulesLookup(deps, { rule: "704.5" });

    assert.equal(firstUse, 2);
    assert.equal(requests.length, 2, "no request after the first download");
    assert.ok(r.ok);
    assert.equal(r.value.cache_age_days, 3);
  });

  test("an untruncated result carries no note", async () => {
    const { deps } = harness();

    const r = await rulesLookup(deps, { rule: "702" });

    assert.ok(r.ok);
    assert.equal(r.value.truncated, false);
    assert.equal("note" in r.value, false);
  });

  test("a truncated broad rule carries next_rule and a note naming it", async () => {
    const lines = [...SYNTHETIC_LINES];
    for (const letter of ["a", "b", "c"]) {
      const at = lines.findIndex((l) => l.startsWith(`702.19${letter} `));
      lines[at] = `702.19${letter} ${"z".repeat(20_000)}`;
    }
    const { deps } = harness(syntheticCr(lines));

    const r = await rulesLookup(deps, { rule: "702" });

    assert.ok(r.ok);
    assert.equal(r.value.truncated, true);
    assert.equal(r.value.next_rule, "702.19c");
    assert.match(r.value.note!, /702\.19c/);
  });
});

describe("rulesLookup — the weekly check and the stale copy", () => {
  test("a fresh answer reports stale: false, when it was last checked, and no note", async () => {
    const { deps } = harness();

    const r = await rulesLookup(deps, { rule: "702.19" });

    assert.ok(r.ok);
    assert.equal(r.value.stale, false);
    assert.equal(r.value.checked_at, "2026-11-10T00:00:00.000Z");
    assert.equal("note" in r.value, false);
  });

  test("when Wizards is unreachable at the weekly check, the cached rules are served stale with their age", async () => {
    const { deps, setNow } = harness();
    await rulesLookup(deps, { rule: "702.19" });

    setNow(DOWNLOADED_AT + 9 * DAY);
    deps.site = {
      get: () => Promise.resolve({ ok: false, error: { code: "network", message: "Could not reach Wizards of the Coast: ENOTFOUND" } }),
      post: () => Promise.reject(new Error("no POST")),
    };
    const r = await rulesLookup(deps, { rule: "702.19" });

    assert.ok(r.ok, r.ok ? "" : r.error.message);
    assert.equal(r.value.stale, true);
    assert.equal(r.value.cr_effective_date, "2026-11-06");
    assert.equal(r.value.cache_age_days, 9);
    assert.equal(r.value.checked_at, "2026-11-10T00:00:00.000Z");
    assert.match(r.value.note!, /2026-11-06/);
    assert.match(r.value.note!, /9 days/);
    assert.match(r.value.note!, /ENOTFOUND/);
  });

  test("a keyword query on a stale copy carries stale and the same note", async () => {
    const { deps, setNow } = harness();
    await rulesLookup(deps, { query: "trample" });

    setNow(DOWNLOADED_AT + 9 * DAY);
    deps.site = {
      get: () => Promise.resolve({ ok: false, error: { code: "network", message: "Could not reach Wizards of the Coast: ENOTFOUND" } }),
      post: () => Promise.reject(new Error("no POST")),
    };
    const r = await rulesLookup(deps, { query: "trample" });

    assert.ok(r.ok, r.ok ? "" : r.error.message);
    assert.equal(r.value.stale, true);
    assert.equal(r.value.glossary!.length, 1);
    assert.match(r.value.note!, /2026-11-06/);
  });
});

describe("rulesLookup — keyword query", () => {
  test("returns the glossary entry first, then numbered rules, with the same version and citation", async () => {
    const { deps } = harness();

    const r = await rulesLookup(deps, { query: "trample" });

    assert.ok(r.ok, r.ok ? "" : r.error.message);
    assert.equal(r.value.query, "trample");
    assert.deepEqual(r.value.glossary, [{ term: "Trample", definition: "A synthetic keyword ability. See rule 702.19." }]);
    assert.deepEqual(r.value.rules.map((e) => e.number), ["702.19", "702.19a", "702.19b", "702.19c"]);
    assert.equal(r.value.cr_effective_date, "2026-11-06");
    assert.equal(r.value.citation_url, `${MEDIA}/2026/downloads/MagicCompRules%2020261106.pdf`);
    assert.equal(r.value.cache_age_days, 0);
    assert.equal(r.value.truncated, false);
    assert.equal("note" in r.value, false);
  });

  test("no match is a successful empty result with a note to rephrase", async () => {
    const { deps } = harness();

    const r = await rulesLookup(deps, { query: "banding" });

    assert.ok(r.ok, r.ok ? "" : r.error.message);
    assert.deepEqual(r.value.glossary, []);
    assert.deepEqual(r.value.rules, []);
    assert.equal(r.value.total_rule_matches, 0);
    assert.equal(r.value.truncated, false);
    assert.match(r.value.note!, /no glossary term or rule/i);
  });

  test("a broad term is cut to the budget, says how many matched, and the whole response fits", async () => {
    let lines: readonly string[] = SYNTHETIC_LINES;
    for (const n of ["702.19a", "702.19b", "702.19c", "704.5k", "704.5m"]) {
      const copy = [...lines];
      copy[copy.findIndex((l) => l.startsWith(`${n} `))] = `${n} damage ${"z".repeat(20_000)}`;
      lines = copy;
    }
    const { deps } = harness(syntheticCr(lines));

    const r = await rulesLookup(deps, { query: "damage" });

    assert.ok(r.ok);
    assert.equal(r.value.truncated, true);
    assert.equal(r.value.total_rule_matches, 5);
    assert.match(r.value.note!, new RegExp(`${r.value.rules.length} of 5 matching rules`));
    assert.ok(JSON.stringify(r.value).length <= 50_000, `${JSON.stringify(r.value).length} chars`);
  });

  test("an unreadable glossary: rule-text matches still come back, with a note saying so, and the copy is cached", async () => {
    const at = SYNTHETIC_LINES.lastIndexOf("Glossary");
    const end = SYNTHETIC_LINES.lastIndexOf("Credits");
    const { deps, requests } = harness(syntheticCr([...SYNTHETIC_LINES.slice(0, at + 1), "", ...SYNTHETIC_LINES.slice(end)]));

    const r = await rulesLookup(deps, { query: "trample" });

    assert.ok(r.ok, r.ok ? "" : r.error.message);
    assert.deepEqual(r.value.glossary, []);
    assert.deepEqual(r.value.rules.map((e) => e.number), ["702.19", "702.19a", "702.19b", "702.19c"]);
    assert.match(r.value.note!, /glossary could not be read/i);

    const byNumber = await rulesLookup(deps, { rule: "702.19" });
    assert.ok(byNumber.ok);
    assert.equal("note" in byNumber.value, false, "rule-number lookups are unaffected");
    assert.equal(requests.length, 2, "the copy was cached normally: no second download");
  });

  test("an unreadable glossary with no rule match still says the glossary could not be read", async () => {
    const at = SYNTHETIC_LINES.lastIndexOf("Glossary");
    const end = SYNTHETIC_LINES.lastIndexOf("Credits");
    const { deps } = harness(syntheticCr([...SYNTHETIC_LINES.slice(0, at + 1), "", ...SYNTHETIC_LINES.slice(end)]));

    const r = await rulesLookup(deps, { query: "banding" });

    assert.ok(r.ok);
    assert.match(r.value.note!, /glossary could not be read/i);
  });

  test("both rule and query is a bad_request, refused before any download", async () => {
    const { deps, requests } = harness();

    const r = await rulesLookup(deps, { rule: "702.19", query: "trample" });

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "bad_request");
    assert.deepEqual(requests, []);
  });

  test("neither rule nor query is a bad_request, refused before any download", async () => {
    const { deps, requests } = harness();

    const r = await rulesLookup(deps, {});

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "bad_request");
    assert.match(r.error.message, /`rule`.*`query`/);
    assert.deepEqual(requests, []);
  });

  test("an empty query is a bad_request, refused before any download", async () => {
    const { deps, requests } = harness();

    const r = await rulesLookup(deps, { query: "  " });

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "bad_request");
    assert.deepEqual(requests, []);
  });
});

describe("rulesLookup — failures", () => {
  test("an unknown rule number is a structured not_found naming it", async () => {
    const { deps } = harness();

    const r = await rulesLookup(deps, { rule: "702.999" });

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "not_found");
    assert.match(r.error.message, /702\.999/);
  });

  test("something that is not a rule number is refused before any download", async () => {
    const { deps, requests } = harness();

    const r = await rulesLookup(deps, { rule: "how does trample work" });

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "bad_request");
    assert.deepEqual(requests, []);
  });

  test("a download failure on first use reaches the caller as the store's failure", async () => {
    const { deps } = harness();
    deps.site = {
      get: () => Promise.resolve({ ok: false, error: { code: "network", message: "Could not reach Wizards of the Coast: ENOTFOUND" } }),
      post: () => Promise.reject(new Error("no POST")),
    };

    const r = await rulesLookup(deps, { rule: "702.19" });

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "network");
  });
});
