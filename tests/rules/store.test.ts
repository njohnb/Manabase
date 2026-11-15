import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HttpClient } from "../../src/http/client.ts";
import type { Result } from "../../src/result.ts";
import { ensureRules, nodeRulesFs } from "../../src/rules/store.ts";
import type { RulesFs, RulesStoreDeps } from "../../src/rules/store.ts";
import { SYNTHETIC_LINES, syntheticCr } from "./synthetic-cr.ts";

const CACHE = join("cache-root");
const NOW = Date.parse("2026-11-15T12:00:00Z");
const MEDIA = "https://media.wizards.com";

const LANDING =
  `<a href="${MEDIA}/2026/downloads/MagicCompRules 20261106.pdf">pdf</a>` +
  `<a href="${MEDIA}/2026/downloads/MagicCompRules 20261106.txt">txt</a>`;

/** A text client answering every GET with one canned Result, recording the paths it was asked. */
function fakeClient(result: Result<unknown>): { client: HttpClient; paths: string[] } {
  const paths: string[] = [];
  return {
    paths,
    client: {
      get(path) { paths.push(path); return Promise.resolve(result); },
      post: () => Promise.reject(new Error("no POST to Wizards")),
    },
  };
}

/** An in-memory filesystem. `failWrites` makes every write reject, as a read-only disk would. */
function memoryFs(initial: Record<string, string> = {}, failWrites = false): RulesFs & { files: Map<string, string> } {
  const files = new Map(Object.entries(initial));
  return {
    files,
    readText: (path) => Promise.resolve(files.get(path)),
    writeText: (path, text) => {
      if (failWrites) return Promise.reject(new Error("EROFS"));
      files.set(path, text);
      return Promise.resolve();
    },
    remove: (path) => { files.delete(path); return Promise.resolve(); },
  };
}

function deps(over: Partial<RulesStoreDeps> & { siteResult?: Result<unknown>; mediaResult?: Result<unknown> } = {}) {
  const site = fakeClient(over.siteResult ?? { ok: true, value: LANDING });
  const media = fakeClient(over.mediaResult ?? { ok: true, value: syntheticCr() });
  const fs = over.fs ?? memoryFs();
  const d: RulesStoreDeps = {
    site: site.client,
    media: media.client,
    siteBaseUrl: "https://magic.wizards.com",
    mediaBaseUrl: MEDIA,
    fs,
    now: over.now ?? (() => NOW),
    cacheDir: CACHE,
  };
  return { d, site, media, fs };
}

const TXT_PATH = join(CACHE, "rules", "cr-20261106.txt");
const LEGACY_TXT_PATH = join(CACHE, "rules", "cr.txt");
const META_PATH = join(CACHE, "rules", "meta.json");

describe("ensureRules — first use downloads and caches", () => {
  test("one landing-page GET, one media GET of the encoded path, then an index", async () => {
    const { d, site, media } = deps();

    const r = await ensureRules(d);

    assert.ok(r.ok, r.ok ? "" : r.error.message);
    assert.deepEqual(site.paths, ["/en/rules"]);
    assert.deepEqual(media.paths, ["/2026/downloads/MagicCompRules%2020261106.txt"]);
    assert.equal(r.value.index.effectiveDate, "2026-11-06");
    assert.equal(r.value.citationUrl, `${MEDIA}/2026/downloads/MagicCompRules%2020261106.pdf`);
    assert.equal(r.value.fetchedAt, NOW);
  });

  test("the TXT and its metadata are written under <cacheDir>/rules", async () => {
    const { d, fs } = deps();

    await ensureRules(d);

    const memory = fs as ReturnType<typeof memoryFs>;
    assert.equal(memory.files.get(TXT_PATH), syntheticCr());
    const meta = JSON.parse(memory.files.get(META_PATH)!);
    assert.equal(meta.dateStamp, "20261106");
    assert.equal(meta.fetchedAt, "2026-11-15T12:00:00.000Z");
  });
});

describe("ensureRules — a later call reads the cache and makes no request", () => {
  test("a second call against the same disk issues no GET at all", async () => {
    const fs = memoryFs();
    await ensureRules(deps({ fs }).d);

    const later = deps({ fs, now: () => NOW + 86_400_000 });
    const r = await ensureRules(later.d);

    assert.ok(r.ok);
    assert.deepEqual(later.site.paths, []);
    assert.deepEqual(later.media.paths, []);
    assert.equal(r.value.fetchedAt, NOW, "the age is the download's, not this call's");
    assert.equal(r.value.index.rules.length > 0, true);
  });

  test("metadata without its TXT is not a cache: it downloads again", async () => {
    const fs = memoryFs({ [META_PATH]: JSON.stringify({ dateStamp: "20261106", citationUrl: "x", fetchedAt: "2026-11-01T00:00:00.000Z" }) });
    const { d, site } = deps({ fs });

    const r = await ensureRules(d);

    assert.ok(r.ok);
    assert.deepEqual(site.paths, ["/en/rules"]);
  });

  test("a cached TXT that no longer parses is downloaded again", async () => {
    const fs = memoryFs({
      [TXT_PATH]: "garbage",
      [META_PATH]: JSON.stringify({ dateStamp: "20261106", citationUrl: "x", fetchedAt: "2026-11-01T00:00:00.000Z", txtFile: "cr-20261106.txt" }),
    });
    const { d, site } = deps({ fs });

    const r = await ensureRules(d);

    assert.ok(r.ok);
    assert.deepEqual(site.paths, ["/en/rules"]);
  });
});

describe("ensureRules — first use with no cache that fails is a structured failure", () => {
  test("a 403 from the landing page is reported as a block, never worked around (§3.7)", async () => {
    const { d, media, fs } = deps({
      siteResult: { ok: false, error: { code: "unexpected", message: "Wizards of the Coast returned an unexpected status 403.", status: 403 } },
    });

    const r = await ensureRules(d);

    assert.ok(r.ok === false);
    assert.equal(r.error.status, 403);
    assert.match(r.error.message, /refused/i);
    assert.match(r.error.message, /not worked around/i);
    assert.deepEqual(media.paths, []);
    assert.equal((fs as ReturnType<typeof memoryFs>).files.size, 0);
  });

  test("a landing page with no TXT link fails without touching the media host", async () => {
    const { d, media } = deps({ siteResult: { ok: true, value: "<html>Just a moment...</html>" } });

    const r = await ensureRules(d);

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "unexpected");
    assert.deepEqual(media.paths, []);
  });

  test("a TXT link on any other host is refused, never fetched", async () => {
    const { d, media } = deps({
      siteResult: { ok: true, value: `<a href="https://elsewhere.example/MagicCompRules 20261106.txt">x</a>` },
    });

    const r = await ensureRules(d);

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "unexpected");
    assert.match(r.error.message, /elsewhere\.example/);
    assert.deepEqual(media.paths, []);
  });

  test("a media failure is passed through with its status, and nothing is cached", async () => {
    const { d, fs } = deps({
      mediaResult: { ok: false, error: { code: "not_found", message: "Wizards of the Coast found no match for the request.", status: 404 } },
    });

    const r = await ensureRules(d);

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "not_found");
    assert.equal(r.error.status, 404);
    assert.equal((fs as ReturnType<typeof memoryFs>).files.size, 0);
  });

  test("a downloaded file that does not parse is a failure, and nothing is cached", async () => {
    const { d, fs } = deps({ mediaResult: { ok: true, value: "<html>not the rules</html>" } });

    const r = await ensureRules(d);

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "unexpected");
    assert.equal((fs as ReturnType<typeof memoryFs>).files.size, 0);
  });
});

const DAY = 86_400_000;
const WEEK = 7 * DAY;

/** A landing page listing one dated trio under `stamp`. */
function landing(stamp: string): string {
  return (
    `<a href="${MEDIA}/2026/downloads/MagicCompRules ${stamp}.pdf">pdf</a>` +
    `<a href="${MEDIA}/2026/downloads/MagicCompRules ${stamp}.txt">txt</a>`
  );
}

/** The synthetic CR re-dated, so a re-download is observable through `effectiveDate`. */
function crDated(longDate: string): string {
  return syntheticCr(SYNTHETIC_LINES.map((l) => (l.startsWith("These rules are effective") ? `These rules are effective as of ${longDate}.` : l)));
}

/** A disk holding the 20261106 copy, downloaded and last checked at NOW. */
async function seeded() {
  const fs = memoryFs();
  const first = await ensureRules(deps({ fs }).d);
  assert.ok(first.ok);
  return fs;
}

const NETWORK_DOWN: Result<unknown> = {
  ok: false,
  error: { code: "network", message: "Could not reach Wizards of the Coast: ENOTFOUND" },
};

describe("ensureRules — the seven-day revalidation", () => {
  test("a copy checked just under 7 days ago is served with no request", async () => {
    const fs = await seeded();
    const later = deps({ fs, now: () => NOW + WEEK - 1 });

    const r = await ensureRules(later.d);

    assert.ok(r.ok);
    assert.deepEqual(later.site.paths, []);
    assert.deepEqual(later.media.paths, []);
    assert.equal(r.value.stale, false);
    assert.equal(r.value.checkedAt, NOW);
  });

  test("at 7 days an unchanged stamp costs one landing-page GET, no download, and moves the check time", async () => {
    const fs = await seeded();
    const later = deps({ fs, now: () => NOW + WEEK });

    const r = await ensureRules(later.d);

    assert.ok(r.ok, r.ok ? "" : r.error.message);
    assert.deepEqual(later.site.paths, ["/en/rules"]);
    assert.deepEqual(later.media.paths, []);
    assert.equal(r.value.stale, false);
    assert.equal(r.value.fetchedAt, NOW, "the copy is the same download");
    assert.equal(r.value.checkedAt, NOW + WEEK);

    // The moved check time is persisted: the next day costs no request at all.
    const next = deps({ fs, now: () => NOW + WEEK + DAY });
    await ensureRules(next.d);
    assert.deepEqual(next.site.paths, []);
  });

  test("at 7 days a changed stamp re-downloads the new file and replaces the cached copy", async () => {
    const fs = await seeded();
    const later = deps({
      fs,
      now: () => NOW + WEEK,
      siteResult: { ok: true, value: landing("20270213") },
      mediaResult: { ok: true, value: crDated("February 13, 2027") },
    });

    const r = await ensureRules(later.d);

    assert.ok(r.ok, r.ok ? "" : r.error.message);
    assert.deepEqual(later.site.paths, ["/en/rules"]);
    assert.deepEqual(later.media.paths, ["/2026/downloads/MagicCompRules%2020270213.txt"]);
    assert.equal(r.value.index.effectiveDate, "2027-02-13");
    assert.equal(r.value.citationUrl, `${MEDIA}/2026/downloads/MagicCompRules%2020270213.pdf`);
    assert.equal(r.value.fetchedAt, NOW + WEEK);
    assert.equal(r.value.stale, false);

    // The new copy is what the disk now serves, with no request.
    const next = deps({ fs, now: () => NOW + WEEK + DAY });
    const again = await ensureRules(next.d);
    assert.ok(again.ok);
    assert.equal(again.value.index.effectiveDate, "2027-02-13");
    assert.deepEqual(next.site.paths, []);

    const files = (fs as ReturnType<typeof memoryFs>).files;
    assert.equal(files.has(TXT_PATH), false, "the replaced copy is removed once the switch is made");
    assert.equal(files.has(join(CACHE, "rules", "cr-20270213.txt")), true);
  });

  test("a cache written before revalidation existed (cr.txt, no txtFile) is still served", async () => {
    const fs = memoryFs({
      [LEGACY_TXT_PATH]: syntheticCr(),
      [META_PATH]: JSON.stringify({ dateStamp: "20261106", txtUrl: "x", citationUrl: "c", fetchedAt: "2026-11-15T12:00:00.000Z" }),
    });
    const later = deps({ fs, now: () => NOW + DAY });

    const r = await ensureRules(later.d);

    assert.ok(r.ok);
    assert.equal(r.value.citationUrl, "c");
    assert.deepEqual(later.site.paths, []);
  });

  test("a metadata file naming any other path is not a cache", async () => {
    const fs = memoryFs({
      [META_PATH]: JSON.stringify({ dateStamp: "20261106", citationUrl: "c", fetchedAt: "2026-11-15T12:00:00.000Z", txtFile: "../../secrets.txt" }),
    });
    const later = deps({ fs });

    const r = await ensureRules(later.d);

    assert.ok(r.ok);
    assert.deepEqual(later.site.paths, ["/en/rules"], "downloaded afresh rather than read from a foreign path");
  });
});

describe("ensureRules — a failed check serves the cached copy as stale, never a failure", () => {
  const failures: Array<[string, { siteResult?: Result<unknown>; mediaResult?: Result<unknown> }, RegExp]> = [
    ["the landing page is unreachable", { siteResult: NETWORK_DOWN }, /ENOTFOUND/],
    [
      "Wizards refuses the request (403)",
      { siteResult: { ok: false, error: { code: "unexpected", message: "Wizards of the Coast returned an unexpected status 403.", status: 403 } } },
      /refused/i,
    ],
    ["the landing page lost its dated TXT link (a challenge or a redesign)", { siteResult: { ok: true, value: "<html>Just a moment...</html>" } }, /no dated/i],
    ["the stamp changed but the download fails", { siteResult: { ok: true, value: landing("20270213") }, mediaResult: NETWORK_DOWN }, /ENOTFOUND/],
    ["the stamp changed but the new file does not parse", { siteResult: { ok: true, value: landing("20270213") }, mediaResult: { ok: true, value: "<html>not the rules</html>" } }, /./],
  ];

  for (const [name, results, reason] of failures) {
    test(`${name}: the cached copy, stale, with its date and age`, async () => {
      const fs = await seeded();
      const later = deps({ fs, now: () => NOW + WEEK + 2 * DAY, ...results });

      const r = await ensureRules(later.d);

      assert.ok(r.ok, r.ok ? "" : `expected the cache, got: ${r.error.message}`);
      assert.equal(r.value.stale, true);
      assert.match(r.value.staleReason!, reason);
      assert.equal(r.value.index.effectiveDate, "2026-11-06");
      assert.equal(r.value.fetchedAt, NOW, "the age reported is the cached copy's");
      assert.equal(r.value.checkedAt, NOW, "a failed check is not a check");
      assert.equal((fs as ReturnType<typeof memoryFs>).files.get(TXT_PATH), syntheticCr(), "the good copy is untouched");
    });
  }

  test("a pre-revalidation cache (no checkedAt) counts its download as its check", async () => {
    const fs = await seeded();
    const memory = fs as ReturnType<typeof memoryFs>;
    const meta = JSON.parse(memory.files.get(META_PATH)!);
    delete meta.checkedAt;
    memory.files.set(META_PATH, JSON.stringify(meta));

    const early = deps({ fs, now: () => NOW + WEEK - 1 });
    await ensureRules(early.d);
    assert.deepEqual(early.site.paths, []);

    const due = deps({ fs, now: () => NOW + WEEK });
    await ensureRules(due.d);
    assert.deepEqual(due.site.paths, ["/en/rules"]);
  });

  test("a fresh copy carries no staleReason", async () => {
    const fs = await seeded();
    const r = await ensureRules(deps({ fs, now: () => NOW + DAY }).d);

    assert.ok(r.ok);
    assert.equal(r.value.stale, false);
    assert.equal("staleReason" in r.value, false);
  });
});

describe("ensureRules — a partly written download never replaces a good cached copy", () => {
  /**
   * A disk that, from the moment it is armed, writes only the first half of any file over 1 kB
   * and then rejects — a full disk or a killed process mid-write.
   */
  function tornFs(files: Map<string, string>): RulesFs & { arm(): void } {
    let armed = false;
    return {
      arm: () => { armed = true; },
      readText: (path) => Promise.resolve(files.get(path)),
      writeText: (path, text) => {
        if (armed && text.length > 1024) {
          files.set(path, text.slice(0, text.length / 2));
          return Promise.reject(new Error("ENOSPC"));
        }
        files.set(path, text);
        return Promise.resolve();
      },
      remove: (path) => { files.delete(path); return Promise.resolve(); },
    };
  }

  test("a torn write of the new file leaves the old copy served", async () => {
    const files = new Map<string, string>();
    const fs = tornFs(files);
    assert.ok((await ensureRules(deps({ fs }).d)).ok);

    fs.arm();
    const refresh = deps({
      fs,
      now: () => NOW + WEEK,
      siteResult: { ok: true, value: landing("20270213") },
      mediaResult: { ok: true, value: crDated("February 13, 2027") },
    });
    const r = await ensureRules(refresh.d);
    assert.ok(r.ok, "the download itself succeeded, so this answer is the new copy");
    assert.equal(r.value.index.effectiveDate, "2027-02-13");

    // Wizards is now unreachable: the disk must still hold the good 20261106 copy.
    const after = deps({ fs, now: () => NOW + WEEK + DAY, siteResult: NETWORK_DOWN });
    const served = await ensureRules(after.d);
    assert.ok(served.ok, served.ok ? "" : served.error.message);
    assert.equal(served.value.index.effectiveDate, "2026-11-06");
    assert.equal(served.value.stale, true);
  });
});

describe("nodeRulesFs — the production adapter", () => {
  test("writes create the directory, overwrite in place via a renamed temp file, and leave no temp behind", async () => {
    const root = mkdtempSync(join(tmpdir(), "manabase-rulesfs-"));
    try {
      const path = join(root, "rules", "meta.json");
      await nodeRulesFs.writeText(path, "one");
      await nodeRulesFs.writeText(path, "two");

      assert.equal(await nodeRulesFs.readText(path), "two");
      assert.deepEqual(readdirSync(join(root, "rules")), ["meta.json"]);

      await nodeRulesFs.remove(path);
      assert.equal(await nodeRulesFs.readText(path), undefined);
      await nodeRulesFs.remove(path); // removing what is gone is not an error
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("ensureRules — a cache write failure costs the cache, not the answer", () => {
  test("the downloaded rules are still returned when the disk refuses the write", async () => {
    const { d } = deps({ fs: memoryFs({}, true) });

    const r = await ensureRules(d);

    assert.ok(r.ok);
    assert.equal(r.value.index.effectiveDate, "2026-11-06");
  });
});
