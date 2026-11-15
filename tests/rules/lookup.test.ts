import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseRules } from "../../src/rules/parser.ts";
import type { RulesIndex } from "../../src/rules/parser.ts";
import { lookupRule } from "../../src/rules/lookup.ts";
import { SYNTHETIC_LINES, syntheticCr } from "./synthetic-cr.ts";

function index(lines: readonly string[] = SYNTHETIC_LINES): RulesIndex {
  const r = parseRules(syntheticCr(lines));
  assert.ok(r.ok);
  return r.value;
}

function numbersFor(rule: string, idx = index()): string[] {
  const r = lookupRule(idx, rule);
  assert.ok(r.ok, r.ok ? "" : r.error.message);
  return r.value.rules.map((entry) => entry.number);
}

describe("lookupRule — a rule and every subrule under it", () => {
  test("702.19 returns itself and a–c, and NOT 702.190, which only shares the prefix", () => {
    assert.deepEqual(numbersFor("702.19"), ["702.19", "702.19a", "702.19b", "702.19c"]);
  });

  test("a subrule returns only itself", () => {
    assert.deepEqual(numbersFor("702.19b"), ["702.19b"]);
  });

  test("a three-digit rule returns every numbered rule under it", () => {
    assert.deepEqual(numbersFor("702"), [
      "702", "702.1", "702.19", "702.19a", "702.19b", "702.19c", "702.190", "702.190a",
    ]);
  });

  test("a one-digit section returns its rules", () => {
    assert.deepEqual(numbersFor("1"), ["1", "100", "100.1", "100.1a", "119", "119.1", "119.1d"]);
  });

  test("subrules past a skipped letter are all reached", () => {
    assert.deepEqual(numbersFor("704.5"), ["704.5", "704.5k", "704.5m", "704.5n", "704.5p", "704.5aa"]);
  });

  test("the text comes back with the number", () => {
    const r = lookupRule(index(), "702.19a");
    assert.ok(r.ok);
    assert.deepEqual(r.value.rules, [{ number: "702.19a", text: "Trample is a synthetic static ability." }]);
    assert.equal(r.value.truncated, false);
  });

  test("written the way people write it: trailing period, spaces, a capital letter, a 'rule' prefix", () => {
    for (const written of ["702.19.", " 702.19 ", "rule 702.19", "Rule 702.19"]) {
      assert.deepEqual(numbersFor(written), ["702.19", "702.19a", "702.19b", "702.19c"], written);
    }
    assert.deepEqual(numbersFor("702.19B"), ["702.19b"]);
  });
});

describe("lookupRule — failures name the problem", () => {
  test("an unknown rule number is not_found, naming the number", () => {
    const r = lookupRule(index(), "702.999");
    assert.ok(r.ok === false);
    assert.equal(r.error.code, "not_found");
    assert.match(r.error.message, /702\.999/);
  });

  test("a skipped letter is simply unknown", () => {
    const r = lookupRule(index(), "704.5l");
    assert.ok(r.ok === false);
    assert.equal(r.error.code, "not_found");
  });

  test("something that is not a rule number is bad_request, saying what one looks like", () => {
    const r = lookupRule(index(), "trample");
    assert.ok(r.ok === false);
    assert.equal(r.error.code, "bad_request");
    assert.match(r.error.message, /702\.19/);
  });
});

describe("lookupRule — a broad rule is bounded, and the bound is reported", () => {
  test("rules past the byte budget are cut and the first omitted one is named", () => {
    const long = "x".repeat(20_000);
    const lines = [...SYNTHETIC_LINES];
    lines.splice(lines.indexOf("702.19a Trample is a synthetic static ability."), 1, `702.19a ${long}`);
    lines.splice(lines.indexOf("702.19b The controller assigns synthetic damage."), 1, `702.19b ${long}`);
    lines.splice(lines.indexOf("702.19c Multiple instances of trample are redundant."), 1, `702.19c ${long}`);

    const r = lookupRule(index(lines), "702");

    assert.ok(r.ok);
    assert.deepEqual(r.value.rules.map((e) => e.number), ["702", "702.1", "702.19", "702.19a", "702.19b"]);
    assert.equal(r.value.truncated, true);
    assert.equal(r.value.next_rule, "702.19c");
  });

  test("the requested rule itself is always returned, however long", () => {
    const lines = [...SYNTHETIC_LINES];
    lines.splice(lines.indexOf("702.19a Trample is a synthetic static ability."), 1, `702.19a ${"y".repeat(80_000)}`);

    const r = lookupRule(index(lines), "702.19a");

    assert.ok(r.ok);
    assert.equal(r.value.rules.length, 1);
    assert.equal(r.value.truncated, false);
  });
});
