import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseRules } from "../../src/rules/parser.ts";
import type { RulesIndex } from "../../src/rules/parser.ts";
import { RULES_BYTE_BUDGET, searchRules } from "../../src/rules/lookup.ts";
import { SYNTHETIC_LINES, syntheticCr } from "./synthetic-cr.ts";

function index(lines: readonly string[] = SYNTHETIC_LINES): RulesIndex {
  const r = parseRules(syntheticCr(lines));
  assert.ok(r.ok, r.ok ? "" : r.error.message);
  return r.value;
}

/** The synthetic CR with one line's text replaced, found by its leading number. */
function withRule(number: string, text: string, lines: readonly string[] = SYNTHETIC_LINES): string[] {
  const copy = [...lines];
  const at = copy.findIndex((line) => line.startsWith(`${number} `) || line.startsWith(`${number}. `));
  assert.ok(at >= 0, number);
  copy[at] = `${number} ${text}`;
  return copy;
}

describe("searchRules — glossary first, then rules with their numbers", () => {
  test("a keyword returns its glossary entry, then every rule mentioning it, numbered", () => {
    const r = searchRules(index(), "trample");

    assert.ok(r.ok, r.ok ? "" : r.error.message);
    assert.deepEqual(r.value.glossary.map((g) => g.term), ["Trample"]);
    assert.deepEqual(r.value.rules.map((e) => e.number), ["702.19", "702.19a", "702.19b", "702.19c"]);
    assert.equal(r.value.rules[0]!.text, "Trample");
    assert.equal(r.value.truncated, false);
  });

  test("the rule whose heading IS the term comes before earlier rules that merely mention it", () => {
    const idx = index(withRule("100.1.", "Trample is mentioned early, outside its own rule."));

    const r = searchRules(idx, "Trample");

    assert.ok(r.ok);
    assert.deepEqual(r.value.rules.map((e) => e.number), ["702.19", "100.1", "702.19a", "702.19b", "702.19c"]);
  });

  test("a glossary term whose name IS the query comes before terms that only contain it", () => {
    const lines = [...SYNTHETIC_LINES];
    lines.splice(lines.indexOf("Trample"), 0, "Mana", "Synthetic mana.", "");

    const r = searchRules(index(lines), "mana");

    assert.ok(r.ok);
    assert.deepEqual(r.value.glossary.map((g) => g.term), ["Mana", "Mana Value"]);
  });

  test("matching is case-insensitive and collapses whitespace in the query", () => {
    const r = searchRules(index(), "  MANA   value ");

    assert.ok(r.ok);
    assert.deepEqual(r.value.glossary, [
      { term: "Mana Value", definition: "The synthetic total of a mana cost.\nSee rule 702.1." },
    ]);
  });

  test("a match must start at a word: 'ward' does not match 'toward'", () => {
    const idx = index(withRule("100.1.", "Players move toward a synthetic goal."));

    const r = searchRules(idx, "ward");

    assert.ok(r.ok);
    assert.deepEqual(r.value.rules, []);
  });

  test("the totals count every match, shown or not", () => {
    const r = searchRules(index(), "synthetic");

    assert.ok(r.ok);
    assert.equal(r.value.total_rule_matches, r.value.rules.length);
    assert.equal(r.value.total_glossary_matches, 0);
  });
});

describe("searchRules — no matches", () => {
  test("is a successful empty result, not a failure", () => {
    const r = searchRules(index(), "banding");

    assert.ok(r.ok, r.ok ? "" : r.error.message);
    assert.deepEqual(r.value, {
      glossary: [],
      rules: [],
      total_glossary_matches: 0,
      total_rule_matches: 0,
      truncated: false,
    });
  });

  test("an empty query is a bad_request", () => {
    const r = searchRules(index(), "   ");

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "bad_request");
  });
});

describe("searchRules — a broad term is bounded by the byte budget", () => {
  // Every subrule of 702.19 grows to ~20,000 characters, each mentioning "damage".
  function broad(): RulesIndex {
    let lines: readonly string[] = SYNTHETIC_LINES;
    for (const n of ["702.19a", "702.19b", "702.19c", "704.5k", "704.5m"]) {
      lines = withRule(n, `damage ${"z".repeat(20_000)}`, lines);
    }
    return index(lines);
  }

  test("the matches shown fit the budget, the cut is reported, and the totals count all of them", () => {
    const r = searchRules(broad(), "damage");

    assert.ok(r.ok);
    assert.equal(r.value.truncated, true);
    assert.equal(r.value.total_rule_matches, 5);
    assert.ok(r.value.rules.length < 5, `${r.value.rules.length} shown`);
    assert.ok(r.value.rules.length > 0);
    assert.ok(JSON.stringify(r.value).length <= RULES_BYTE_BUDGET, `${JSON.stringify(r.value).length} chars`);
  });

  test("the glossary entry is kept ahead of the rules when the budget runs out", () => {
    const idx = broad();
    idx.glossary.push({ term: "Damage", definition: "Synthetic damage." });

    const r = searchRules(idx, "damage");

    assert.ok(r.ok);
    assert.deepEqual(r.value.glossary.map((g) => g.term), ["Damage"]);
    assert.equal(r.value.truncated, true);
  });

  test("a single match larger than the whole budget is still returned, and reported as cut-free", () => {
    const idx = index(withRule("702.19a", `colossal ${"z".repeat(RULES_BYTE_BUDGET)}`));

    const r = searchRules(idx, "colossal");

    assert.ok(r.ok);
    assert.deepEqual(r.value.rules.map((e) => e.number), ["702.19a"]);
    assert.equal(r.value.truncated, false);
  });
});
