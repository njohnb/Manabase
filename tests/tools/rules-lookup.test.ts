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
