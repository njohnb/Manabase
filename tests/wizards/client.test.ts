import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { Config } from "../../src/config.ts";
import { createWizardsClients } from "../../src/wizards/client.ts";

const USER_AGENT = "manabase-mtg/0.0.0 (+https://github.com/njohnb/manabase)";

const config: Config = {
  userAgent: USER_AGENT,
  cacheDir: "unused",
  scryfallBaseUrl: "https://scryfall.test",
  spellbookBaseUrl: "https://spellbook.test",
  wizardsSiteBaseUrl: "https://site.wizards.test",
  wizardsMediaBaseUrl: "https://media.wizards.test",
};

interface RecordedCall { url: string; at: number; headers: Record<string, string> }

/** Same virtual clock as tests/http/client.test.ts; each fetch answers the script's next response. */
function makeHarness(script: Response[]) {
  let clock = 0;
  const calls: RecordedCall[] = [];
  const deps = {
    now: () => clock,
    sleep: (ms: number) => { clock += ms; return Promise.resolve(); },
    fetchImpl: ((input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), at: clock, headers: { ...(init?.headers as Record<string, string>) } });
      const next = script.shift();
      return next === undefined ? Promise.reject(new Error("script exhausted")) : Promise.resolve(next);
    }) as typeof fetch,
  };
  return { deps, calls };
}

describe("createWizardsClients — one client per host", () => {
  test("site requests go to the landing-page host as HTML, with the app-naming User-Agent", async () => {
    const { deps, calls } = makeHarness([new Response("<html></html>", { status: 200 })]);
    const { site } = createWizardsClients(config, deps);

    const r = await site.get("/en/rules");

    assert.deepEqual(r, { ok: true, value: "<html></html>" });
    assert.equal(calls[0]!.url, "https://site.wizards.test/en/rules");
    assert.equal(calls[0]!.headers["User-Agent"], USER_AGENT);
    assert.match(calls[0]!.headers["Accept"]!, /^text\/html/);
  });

  test("media requests go to the media host as plain text, path passed through unchanged", async () => {
    const { deps, calls } = makeHarness([new Response("rules", { status: 200 })]);
    const { media } = createWizardsClients(config, deps);

    const r = await media.get("/2026/downloads/MagicCompRules%2020261106.txt");

    assert.deepEqual(r, { ok: true, value: "rules" });
    assert.equal(calls[0]!.url, "https://media.wizards.test/2026/downloads/MagicCompRules%2020261106.txt");
    assert.equal(calls[0]!.headers["User-Agent"], USER_AGENT);
    assert.match(calls[0]!.headers["Accept"]!, /^text\/plain/);
  });

  test("each host self-throttles to the strictest lane: a second call waits 500 ms", async () => {
    const { deps, calls } = makeHarness([
      new Response("a", { status: 200 }),
      new Response("b", { status: 200 }),
    ]);
    const { site } = createWizardsClients(config, deps);

    await site.get("/en/rules");
    await site.get("/en/rules");

    assert.equal(calls[1]!.at - calls[0]!.at, 500);
  });

  test("a failure names Wizards of the Coast as the source", async () => {
    const { deps } = makeHarness([new Response("<html>denied</html>", { status: 403 })]);
    const { site } = createWizardsClients(config, deps);

    const r = await site.get("/en/rules");

    assert.ok(r.ok === false);
    assert.match(r.error.message, /Wizards of the Coast/);
    assert.equal(r.error.status, 403);
  });
});
