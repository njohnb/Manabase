#!/usr/bin/env node
/**
 * Live CAP-04 acceptance: `rules_lookup` against the real Wizards of the Coast site.
 *
 * Runnable on its own (`npm run acceptance:rules`) and deliberately separate from
 * `scripts/cap01-live.mjs`: it never calls Scryfall, so it can run while a Scryfall run is in
 * flight without adding to Scryfall's request rate.
 *
 * Spawns the built server (`node dist/index.js`) with `CLAUDE_PLUGIN_DATA` pointed at a fresh
 * temporary directory, so the first call is a genuine cold-cache download. Wizards is contacted
 * exactly TWICE in the whole run — the landing page, then the dated TXT, one request per host,
 * in sequence (MCP-PRD §3.7: single, spaced, honestly identified). Every later check is served
 * from the cache, and a SECOND server process proves that by reporting the first download's
 * `fetched_at`. Plain Node >= 18 ESM, no dependencies.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_ENTRY = join(REPO_ROOT, "dist", "index.js");
const CALL_TIMEOUT_MS = 120_000;
const PROTOCOL_VERSION = "2025-06-18";

function startServer(cacheDir) {
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: REPO_ROOT,
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, CLAUDE_PLUGIN_DATA: cacheDir },
  });
  const pending = new Map();
  let nextId = 1;
  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line === "") continue;
      const message = JSON.parse(line);
      const entry = pending.get(message.id);
      if (entry === undefined) continue;
      pending.delete(message.id);
      clearTimeout(entry.timer);
      entry.resolve(message);
    }
  });
  const request = (method, params) => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), CALL_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  };
  const notify = (method, params) =>
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  const close = () => { child.stdin.end(); child.kill(); };
  return { request, notify, close };
}

async function initialize(server) {
  await server.request("initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "cr-live", version: "0" },
  });
  server.notify("notifications/initialized", {});
}

async function lookup(server, rule) {
  return call(server, { rule });
}

async function call(server, args) {
  const started = Date.now();
  const message = await server.request("tools/call", { name: "rules_lookup", arguments: args });
  const result = message.result;
  return {
    isError: result.isError === true,
    data: JSON.parse(result.content[0].text),
    chars: result.content[0].text.length,
    ms: Date.now() - started,
  };
}

const results = [];
function check(name, condition, detail) {
  results.push({ name, pass: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const cacheDir = mkdtempSync(join(tmpdir(), "manabase-cr-live-"));
let first;
try {
  // --- Process 1: cold cache. The only two Wizards requests of the run happen here. ---
  const one = startServer(cacheDir);
  try {
    await initialize(one);
    const list = await one.request("tools/list", {});
    check("tools/list declares rules_lookup", list.result.tools.some((t) => t.name === "rules_lookup"));

    first = await lookup(one, "702.19");
    const d = first.data;
    check("cold-cache lookup of 702.19 succeeds", !first.isError, first.isError ? JSON.stringify(d) : `${first.ms} ms, ${first.chars} chars`);
    if (!first.isError) {
      const numbers = d.rules.map((r) => r.number);
      check("702.19 comes first, with its subrules", numbers[0] === "702.19" && numbers.includes("702.19a"), numbers.join(", "));
      check("no 702.19x rule outside the subtree (e.g. 702.190)", numbers.every((n) => n === "702.19" || /^702\.19[a-z]+$/.test(n)));
      check("cr_effective_date is an ISO date", /^\d{4}-\d{2}-\d{2}$/.test(d.cr_effective_date), d.cr_effective_date);
      check("citation_url is Wizards' dated document on media.wizards.com", /^https:\/\/media\.wizards\.com\/.+MagicCompRules%20\d{8}\.(pdf|txt)$/.test(d.citation_url), d.citation_url);
      check("cache_age_days is 0 on a fresh download", d.cache_age_days === 0);
      check("a fresh download is not stale, and was checked when it was fetched", d.stale === false && d.checked_at === d.fetched_at, `stale ${d.stale}, checked_at ${d.checked_at}`);
    }
    // One TXT per date stamp (CAP-04's revalidation), named from the citation's own stamp.
    const stamp = /MagicCompRules%20(\d{8})\./.exec(first?.data.citation_url ?? "")?.[1];
    const txt = join(cacheDir, "rules", `cr-${stamp}.txt`);
    check("the CR is cached under the resolved cache directory", existsSync(txt) && existsSync(join(cacheDir, "rules", "meta.json")), existsSync(txt) ? `${statSync(txt).size} bytes` : "missing");
  } finally {
    one.close();
  }

  // --- Process 2: warm cache. A re-download would stamp a new `fetched_at`. ---
  const two = startServer(cacheDir);
  try {
    await initialize(two);
    const warm = await lookup(two, "704.5");
    check("a new process answers from the cache: same fetched_at, no download", !warm.isError && warm.data.fetched_at === first?.data.fetched_at, `${warm.ms} ms, fetched_at ${warm.data.fetched_at}`);
    const unknown = await lookup(two, "702.999");
    check("an unknown rule number is a structured not_found", unknown.isError && unknown.data.error.code === "not_found", unknown.data.error?.message);

    // --- Keyword `query` (ticket 03). Still served from the same cache: no further request. ---
    const keyword = await call(two, { query: "trample" });
    const k = keyword.data;
    check("query \"trample\" succeeds from the cache", !keyword.isError && k.fetched_at === first?.data.fetched_at, keyword.isError ? JSON.stringify(k) : `${keyword.ms} ms, ${keyword.chars} chars`);
    if (!keyword.isError) {
      check("the glossary definition of Trample comes first", k.glossary[0]?.term === "Trample", k.glossary.map((g) => g.term).join(", "));
      check("rule hits carry their numbers, 702.19 among them", k.rules.length > 0 && k.rules.every((r) => /^\d/.test(r.number)) && k.rules.some((r) => r.number === "702.19"), k.rules.slice(0, 8).map((r) => r.number).join(", "));
      check("the query carries the same CR date and citation as a rule lookup", k.cr_effective_date === first?.data.cr_effective_date && k.citation_url === first?.data.citation_url, k.cr_effective_date);
    }
    const broad = await call(two, { query: "damage" });
    const b = broad.data;
    check("broad query \"damage\" is bounded, flagged truncated, and counts every match", !broad.isError && b.truncated === true && broad.chars <= 50_000 && b.total_rule_matches > b.rules.length, broad.isError ? JSON.stringify(b) : `${b.glossary.length}/${b.total_glossary_matches} glossary, ${b.rules.length}/${b.total_rule_matches} rules, ${broad.chars} chars`);
    const none = await call(two, { query: "zzqx no such rules term" });
    check("a query with no match is a successful empty result", !none.isError && none.data.glossary.length === 0 && none.data.rules.length === 0, none.data.note);
    const both = await call(two, { rule: "702.19", query: "trample" });
    check("both rule and query is a structured bad_request", both.isError && both.data.error.code === "bad_request", both.data.error?.message);
  } finally {
    two.close();
  }
} finally {
  rmSync(cacheDir, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed === 0 ? 0 : 1);
