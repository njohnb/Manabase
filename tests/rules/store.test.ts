import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import type { HttpClient } from "../../src/http/client.ts";
import type { Result } from "../../src/result.ts";
import { ensureRules } from "../../src/rules/store.ts";
import type { RulesFs, RulesStoreDeps } from "../../src/rules/store.ts";
import { syntheticCr } from "./synthetic-cr.ts";

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
    now: () => NOW,
    cacheDir: CACHE,
  };
  return { d, site, media, fs };
}

const TXT_PATH = join(CACHE, "rules", "cr.txt");
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
      [META_PATH]: JSON.stringify({ dateStamp: "20261106", citationUrl: "x", fetchedAt: "2026-11-01T00:00:00.000Z" }),
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

describe("ensureRules — a cache write failure costs the cache, not the answer", () => {
  test("the downloaded rules are still returned when the disk refuses the write", async () => {
    const { d } = deps({ fs: memoryFs({}, true) });

    const r = await ensureRules(d);

    assert.ok(r.ok);
    assert.equal(r.value.index.effectiveDate, "2026-11-06");
  });
});
