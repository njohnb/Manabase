#!/usr/bin/env node
/**
 * Track A — Slice 6: live CAP-01 acceptance harness.
 *
 * Spawns the real built server (`node dist/index.js`), speaks newline-delimited JSON-RPC over
 * its stdio, and runs the 13-check matrix from `docs/slices/TrackA-Slice6.md` against live
 * Scryfall. Plain Node >= 18 ESM: no dependencies, no TypeScript, no build step.
 *
 * Politeness is part of the spec (MCP-PRD §3.4): >= 600 ms between successive `tools/call`s,
 * strictly sequential, never a retry of a failed check, never a deliberate 429. A failed check
 * is recorded and the run continues.
 *
 * Assertions run on `JSON.parse(content[0].text)` — the actual payload — never on raw stdout.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_ENTRY = join(REPO_ROOT, "dist", "index.js");

/** Per-call ceiling. A 429 backoff inside the server legitimately takes ~30 s. */
const CALL_TIMEOUT_MS = 60_000;
/** Minimum gap between successive tools/call requests (Scryfall asks for <= 2/sec). */
const POLITE_GAP_MS = 600;

const PROTOCOL_VERSION = "2025-06-18";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// JSON-RPC over stdio
// ---------------------------------------------------------------------------

function createClient() {
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: REPO_ROOT,
    stdio: ["pipe", "pipe", "inherit"],
  });

  const pending = new Map();
  let nextId = 1;
  let buffer = "";
  let exited = null;

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line === "") continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        console.error(`[harness] non-JSON line from server: ${line}`);
        continue;
      }
      if (message.id === undefined || message.id === null) continue; // notification
      const entry = pending.get(message.id);
      if (entry === undefined) continue;
      pending.delete(message.id);
      clearTimeout(entry.timer);
      entry.resolve(message);
    }
  });

  const failAll = (error) => {
    for (const [id, entry] of pending) {
      pending.delete(id);
      clearTimeout(entry.timer);
      entry.reject(error);
    }
  };

  child.on("exit", (code, signal) => {
    exited = { code, signal };
    failAll(new Error(`server exited early (code=${code}, signal=${signal})`));
  });
  child.on("error", (error) => failAll(error));

  function request(method, params) {
    if (exited !== null) {
      return Promise.reject(new Error(`server already exited (code=${exited.code})`));
    }
    const id = nextId++;
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`timeout after ${CALL_TIMEOUT_MS} ms waiting for ${method} (id ${id})`));
      }, CALL_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(payload + "\n", (error) => {
        if (error) {
          pending.delete(id);
          clearTimeout(timer);
          reject(error);
        }
      });
    });
  }

  function notify(method, params) {
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  function close() {
    failAll(new Error("harness shutting down"));
    child.stdin.end();
    child.kill();
  }

  return { request, notify, close };
}

// ---------------------------------------------------------------------------
// Tool-call helpers
// ---------------------------------------------------------------------------

let lastCallAt = 0;

/**
 * One `tools/call` for `card_search`, spaced >= POLITE_GAP_MS after the previous one.
 * Returns `{ isError, data, chars }`, where `data` is the parsed `content[0].text` payload and
 * `chars` is that payload's character count — the figure issue #25 was measured in. It is free
 * here (the text is already in hand) and adds no calls.
 */
async function callCardSearch(client, args) {
  const waitFor = POLITE_GAP_MS - (Date.now() - lastCallAt);
  if (waitFor > 0) await sleep(waitFor);
  lastCallAt = Date.now();

  const message = await client.request("tools/call", {
    name: "card_search",
    arguments: args,
  });

  if (message.error !== undefined) {
    throw new Error(`JSON-RPC error: ${JSON.stringify(message.error)}`);
  }
  const result = message.result;
  if (result === undefined || !Array.isArray(result.content) || result.content.length === 0) {
    throw new Error(`malformed tool result: ${JSON.stringify(message)}`);
  }
  const first = result.content[0];
  if (first.type !== "text" || typeof first.text !== "string") {
    throw new Error(`expected text content, got: ${JSON.stringify(first)}`);
  }
  return {
    isError: result.isError === true,
    data: JSON.parse(first.text),
    chars: first.text.length,
  };
}

class CheckFailure extends Error {}

function assert(condition, message) {
  if (!condition) throw new CheckFailure(message);
}

// ---------------------------------------------------------------------------
// The 13-check matrix (docs/slices/TrackA-Slice6.md, requirement 3)
// ---------------------------------------------------------------------------

/** Cross-check state: check 5 compares against check 4; check 9 reuses check 8's follow-up call. */
const state = {};

const GAEA_QUERY = '!"Gaea\'s Cradle" set:jgp';

const checks = [
  {
    n: 1,
    label: "o:/^{T}: Add/ — regex reaches Scryfall unmangled",
    criterion: "2",
    baseline: "total_cards 1,554",
    async run(client) {
      const { isError, data } = await callCardSearch(client, { q: "o:/^{T}: Add/" });
      assert(!isError, `expected success, got isError with ${JSON.stringify(data)}`);
      assert(data.total_cards > 1000, `expected total_cards > 1000, got ${data.total_cards}`);
      return `total_cards=${data.total_cards}`;
    },
  },
  {
    n: 2,
    label: "otag:ramp — oracle tag",
    criterion: "3",
    baseline: "total_cards 2,260",
    async run(client) {
      const { isError, data } = await callCardSearch(client, { q: "otag:ramp" });
      assert(!isError, `expected success, got isError with ${JSON.stringify(data)}`);
      assert(data.total_cards > 0, `expected total_cards > 0, got ${data.total_cards}`);
      return `total_cards=${data.total_cards}`;
    },
  },
  {
    n: 3,
    label: "function:removal — otag alias",
    criterion: "3",
    baseline: "total_cards 6,386",
    async run(client) {
      const { isError, data } = await callCardSearch(client, { q: "function:removal" });
      assert(!isError, `expected success, got isError with ${JSON.stringify(data)}`);
      assert(data.total_cards > 0, `expected total_cards > 0, got ${data.total_cards}`);
      return `total_cards=${data.total_cards}`;
    },
  },
  {
    n: 4,
    label: "art:squirrel — art tag",
    criterion: "3",
    baseline: "total_cards 192",
    async run(client) {
      const { isError, data } = await callCardSearch(client, { q: "art:squirrel" });
      assert(!isError, `expected success, got isError with ${JSON.stringify(data)}`);
      assert(data.total_cards > 0, `expected total_cards > 0, got ${data.total_cards}`);
      state.artSquirrelTotal = data.total_cards;
      return `total_cards=${data.total_cards}`;
    },
  },
  {
    n: 5,
    label: "atag:squirrel — art-tag alias, same total as art:squirrel",
    criterion: "3",
    baseline: "total_cards 192",
    async run(client) {
      const { isError, data } = await callCardSearch(client, { q: "atag:squirrel" });
      assert(!isError, `expected success, got isError with ${JSON.stringify(data)}`);
      assert(data.total_cards > 0, `expected total_cards > 0, got ${data.total_cards}`);
      assert(
        state.artSquirrelTotal !== undefined,
        "check 4 did not record a total_cards to compare against",
      );
      assert(
        data.total_cards === state.artSquirrelTotal,
        `alias mismatch: atag:squirrel=${data.total_cards}, art:squirrel=${state.artSquirrelTotal}`,
      );
      state.atagSquirrelTotal = data.total_cards;
      return `total_cards=${data.total_cards} (art:squirrel=${state.artSquirrelTotal})`;
    },
  },
  {
    n: 6,
    label: "f:commander t:creature cmc=1 — pagination reported, not resolved",
    criterion: "9",
    baseline: "total_cards 1,197",
    async run(client) {
      const { isError, data, chars } = await callCardSearch(client, { q: "f:commander t:creature cmc=1" });
      assert(!isError, `expected success, got isError with ${JSON.stringify(data)}`);
      assert(data.total_cards > 175, `expected total_cards > 175, got ${data.total_cards}`);
      assert(data.has_more === true, `expected has_more true, got ${data.has_more}`);
      assert(typeof data.note === "string" && data.note.length > 0, "expected a non-empty note");
      assert(
        data.cards.length <= 88,
        `expected at most one page (<=88 cards), got ${data.cards.length}`,
      );
      return `total_cards=${data.total_cards} has_more=${data.has_more} cards=${data.cards.length} chars=${chars} note="${data.note}"`;
    },
  },
  {
    n: 7,
    label: "usd<1 t:land — price operator + pagination reported",
    criterion: "9",
    baseline: "total_cards 803",
    async run(client) {
      const { isError, data, chars } = await callCardSearch(client, { q: "usd<1 t:land" });
      assert(!isError, `expected success, got isError with ${JSON.stringify(data)}`);
      assert(data.total_cards > 175, `expected total_cards > 175, got ${data.total_cards}`);
      assert(data.has_more === true, `expected has_more true, got ${data.has_more}`);
      assert(typeof data.note === "string" && data.note.length > 0, "expected a non-empty note");
      assert(
        data.cards.length <= 88,
        `expected at most one page (<=88 cards), got ${data.cards.length}`,
      );
      return `total_cards=${data.total_cards} has_more=${data.has_more} cards=${data.cards.length} chars=${chars}`;
    },
  },
  {
    n: 8,
    label: "illustrationtag:dragon — structured failure, server survives",
    criterion: "8",
    baseline: "HTTP 400",
    async run(client) {
      const { isError, data } = await callCardSearch(client, { q: "illustrationtag:dragon" });
      assert(isError === true, `expected isError true, got ${isError} with ${JSON.stringify(data)}`);
      assert(
        data.error !== undefined && data.error !== null,
        `expected an { error } body, got ${JSON.stringify(data)}`,
      );
      assert(
        data.error.code === "bad_request",
        `expected error.code "bad_request", got "${data.error.code}"`,
      );
      assert(
        typeof data.error.details === "string" &&
          data.error.details.includes("All of your terms were ignored"),
        `expected error.details to contain "All of your terms were ignored", got ${JSON.stringify(data.error.details)}`,
      );

      // The failure must not wedge the connection: the *next* check's call is issued here,
      // against the same server process, and must succeed. Its payload is cached for check 9.
      const next = await callCardSearch(client, { q: GAEA_QUERY, unique: "prints" });
      assert(
        !next.isError,
        `server did not survive the failure: next call returned isError with ${JSON.stringify(next.data)}`,
      );
      state.gaeaResult = next;

      const observedStatus = data.error.status !== undefined ? ` status=${data.error.status}` : "";
      return `isError=true code=${data.error.code}${observedStatus} details="${data.error.details}"; next call on same process succeeded (total_cards=${next.data.total_cards})`;
    },
  },
  {
    n: 9,
    label: '!"Gaea\'s Cradle" set:jgp unique:prints — foil-only price resolves',
    criterion: "4",
    baseline: 'usd null, usd_foil "3999.00" → { available: true, finish: "foil" }',
    async run(client) {
      // Issued during check 8 (same server process, already politely spaced) to prove the
      // connection survived a structured failure; reused here rather than re-querying.
      // Fallback: if check 8 aborted before issuing it, query here instead.
      const cached =
        state.gaeaResult ?? (await callCardSearch(client, { q: GAEA_QUERY, unique: "prints" }));
      const { isError, data } = cached;
      assert(!isError, `expected success, got isError with ${JSON.stringify(data)}`);
      assert(Array.isArray(data.cards) && data.cards.length > 0, "expected at least one card");
      const foil = data.cards.find(
        (card) => card.price.available === true && card.price.finish === "foil",
      );
      assert(
        foil !== undefined,
        `expected a card priced { available: true, finish: "foil" }, got ${JSON.stringify(data.cards.map((c) => ({ name: c.name, set: c.set, price: c.price })))}`,
      );
      return `total_cards=${data.total_cards} card="${foil.name}" set=${foil.set} price=${JSON.stringify(foil.price)}`;
    },
  },
  {
    n: 10,
    label: "is:etched unique:prints — etched finish labeled",
    criterion: "5",
    baseline: "1,074 etched-only cards exist",
    async run(client) {
      const { isError, data } = await callCardSearch(client, {
        q: "is:etched",
        unique: "prints",
      });
      assert(!isError, `expected success, got isError with ${JSON.stringify(data)}`);
      assert(Array.isArray(data.cards) && data.cards.length > 0, "expected at least one card");
      const etched = data.cards.find(
        (card) => card.price.available === true && card.price.finish === "etched",
      );
      assert(
        etched !== undefined,
        `no first-page card resolved finish "etched" among ${data.cards.length} cards`,
      );
      const etchedCount = data.cards.filter(
        (card) => card.price.available === true && card.price.finish === "etched",
      ).length;
      return `total_cards=${data.total_cards} etched-priced on page 1=${etchedCount}/${data.cards.length} first="${etched.name}" (${etched.set}) price=${JSON.stringify(etched.price)}`;
    },
  },
  {
    n: 11,
    label: '!"Black Lotus" — paper vs. digital printing, price reason is honest',
    criterion: "6",
    baseline: "LEA paper printing, usd populated",
    async run(client) {
      const { isError, data } = await callCardSearch(client, { q: '!"Black Lotus"' });
      assert(!isError, `expected success, got isError with ${JSON.stringify(data)}`);
      assert(Array.isArray(data.cards) && data.cards.length > 0, "expected at least one card");
      const card = data.cards[0];
      if (card.price.available === true) {
        return `total_cards=${data.total_cards} card="${card.name}" set=${card.set} (${card.set_name}) price=${JSON.stringify(card.price)}`;
      }

      // DRIFT BRANCH (observed 2026-08-03). Two divergences from the 2026-07-29 record, both
      // upstream — neither is a defect here:
      //   (a) a bare `!"Black Lotus"` no longer returns the LEA paper printing; the default
      //       rollup hands back the MTGO (Vintage Masters) printing. The Slice 6 spec
      //       pre-authorized this: record it, and the price must then read `digital-only`,
      //       never a bare no-price (§4.1.3 trap 3). That is what row (a) asserts.
      //   (b) no paper Black Lotus printing carries a USD price any more (2ed/leb/lea all have
      //       usd, usd_foil and usd_etched null, EUR only), so `no-price-data` is the honest
      //       answer for paper — and it must be reported as a *different* reason from
      //       digital-only, which is the actual substance of trap 3 / criterion 6.
      // Because (b) makes Black Lotus unusable as live proof that a paper USD price resolves,
      // a substitute probe (below) keeps that half of criterion 6 evidenced.
      state.blackLotusDigital = { set: card.set, set_name: card.set_name, price: card.price };
      assert(
        card.price.available === false && card.price.reason === "digital-only",
        `the digital printing must read digital-only, got ${JSON.stringify(card.price)} for ${card.name} (${card.set})`,
      );

      const paper = await callCardSearch(client, { q: '!"Black Lotus" game:paper' });
      assert(!paper.isError, `game:paper follow-up failed: ${JSON.stringify(paper.data)}`);
      assert(paper.data.cards.length > 0, "game:paper follow-up returned no cards");
      const paperCard = paper.data.cards[0];
      assert(
        paperCard.price.available === true || paperCard.price.reason === "no-price-data",
        `a paper printing must never be reported as digital-only, got ${JSON.stringify(paperCard.price)} for ${paperCard.set_name}`,
      );
      state.blackLotusPaper = {
        set: paperCard.set,
        set_name: paperCard.set_name,
        price: paperCard.price,
      };

      // Substitute live proof that a paper USD price does resolve as `nonfoil`: `usd>=1`
      // guarantees, by construction, that a matching printing carries a `usd` value.
      const probe = await callCardSearch(client, {
        q: "t:land usd>=1 game:paper",
        unique: "prints",
      });
      assert(!probe.isError, `nonfoil probe failed: ${JSON.stringify(probe.data)}`);
      const priced = probe.data.cards.find(
        (c) => c.price.available === true && c.price.finish === "nonfoil",
      );
      assert(
        priced !== undefined,
        `no first-page card of \`t:land usd>=1 game:paper\` resolved a nonfoil paper price among ${probe.data.cards.length} cards`,
      );

      return (
        `DRIFT: default printing = ${card.set_name} (${card.set}) → ${JSON.stringify(card.price)} ` +
        `(correctly digital-only, not a bare no-price); ` +
        `paper via \`game:paper\` = ${paperCard.set_name} (${paperCard.set}) → ${JSON.stringify(paperCard.price)} ` +
        `(no paper printing carries USD upstream any more — EUR only); ` +
        `nonfoil paper price still resolves: "${priced.name}" (${priced.set}) → ${JSON.stringify(priced.price)}`
      );
    },
  },
  {
    n: 12,
    label: "game:arena -game:paper t:creature — digital-only, not no-price-data",
    criterion: "7",
    baseline: "Arena-only cards have all prices null",
    async run(client) {
      const { isError, data } = await callCardSearch(client, {
        q: "game:arena -game:paper t:creature",
      });
      assert(!isError, `expected success, got isError with ${JSON.stringify(data)}`);
      assert(Array.isArray(data.cards) && data.cards.length > 0, "expected at least one card");
      const card = data.cards[0];
      assert(
        card.price.available === false && card.price.reason === "digital-only",
        `expected { available: false, reason: "digital-only" }, got ${JSON.stringify(card.price)} for ${card.name}`,
      );
      return `total_cards=${data.total_cards} card="${card.name}" set=${card.set} price=${JSON.stringify(card.price)}`;
    },
  },
  {
    n: 13,
    label: 'name:"xyzzynocardhasthisname" — zero matches map to empty success',
    criterion: "supplementary (Slice 3 404→success decision)",
    baseline: "Scryfall returns HTTP 404 for zero matches",
    async run(client) {
      const { isError, data } = await callCardSearch(client, {
        q: 'name:"xyzzynocardhasthisname"',
      });
      assert(!isError, `expected success, got isError with ${JSON.stringify(data)}`);
      assert(
        Array.isArray(data.cards) && data.cards.length === 0,
        `expected cards: [], got ${JSON.stringify(data.cards)}`,
      );
      assert(data.total_cards === 0, `expected total_cards 0, got ${data.total_cards}`);
      assert(typeof data.note === "string" && data.note.length > 0, "expected a non-empty note");
      return `cards=[] total_cards=${data.total_cards} note="${data.note}"`;
    },
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
  console.log("Manabase — CAP-01 live acceptance pass");
  console.log(`  node       ${process.version}`);
  console.log(`  server     ${SERVER_ENTRY}`);
  console.log(`  date       ${new Date().toISOString()}`);
  console.log(`  politeness >= ${POLITE_GAP_MS} ms between tools/call, strictly sequential\n`);

  const client = createClient();
  const results = [];

  try {
    const init = await client.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "cap01-live-harness", version: "1.0.0" },
    });
    if (init.error !== undefined) {
      throw new Error(`initialize failed: ${JSON.stringify(init.error)}`);
    }
    const server = init.result?.serverInfo ?? {};
    console.log(
      `handshake  ok — server ${server.name}@${server.version}, protocol ${init.result?.protocolVersion}\n`,
    );
    client.notify("notifications/initialized", {});

    for (const check of checks) {
      let observed;
      let ok = false;
      try {
        observed = await check.run(client);
        ok = true;
      } catch (error) {
        // Record and continue. A failed check is never retried in this run.
        observed = error instanceof CheckFailure ? error.message : `ERROR: ${error.message}`;
      }
      results.push({ ...check, ok, observed });
      console.log(
        `${ok ? "PASS" : "FAIL"}  ${String(check.n).padStart(2)}  ${check.label}\n        ${observed}`,
      );
    }
  } finally {
    client.close();
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\nSummary: ${passed} passed, ${failed} failed, of ${checks.length} checks.`);
  if (failed > 0) {
    console.log("Failed checks: " + results.filter((r) => !r.ok).map((r) => r.n).join(", "));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`\nharness aborted: ${error.stack ?? error.message}`);
  process.exitCode = 1;
});
