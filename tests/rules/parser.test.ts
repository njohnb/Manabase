import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseRules } from "../../src/rules/parser.ts";
import type { RulesIndex } from "../../src/rules/parser.ts";
import { SYNTHETIC_LINES, syntheticCr } from "./synthetic-cr.ts";

function parsed(text = syntheticCr()): RulesIndex {
  const r = parseRules(text);
  assert.ok(r.ok, r.ok ? "" : r.error.message);
  return r.value;
}

const numbers = (index: RulesIndex) => index.rules.map((rule) => rule.number);
const textOf = (index: RulesIndex, number: string) =>
  index.rules.find((rule) => rule.number === number)?.text;

describe("parseRules — the byte-level format", () => {
  test("reads the effective date as an ISO date, through the BOM", () => {
    assert.equal(parsed().effectiveDate, "2026-11-06");
  });

  test("CRLF leaves no carriage return in any rule text", () => {
    for (const rule of parsed().rules) assert.equal(rule.text.includes("\r"), false, rule.number);
  });

  test("the same document with LF endings and no BOM parses identically", () => {
    const lf = SYNTHETIC_LINES.join("\n");
    assert.deepEqual(parsed(lf).rules, parsed().rules);
  });
});

describe("parseRules — structure", () => {
  test("the contents section is skipped: each heading appears once, from the body", () => {
    const index = parsed();
    assert.deepEqual(numbers(index).filter((n) => n === "100"), ["100"]);
    assert.deepEqual(numbers(index).filter((n) => n === "7"), ["7"]);
  });

  test("every rule in document order, numbers canonicalised without trailing periods", () => {
    assert.deepEqual(numbers(parsed()), [
      "1", "100", "100.1", "100.1a", "119", "119.1", "119.1d",
      "7", "702", "702.1", "702.19", "702.19a", "702.19b", "702.19c", "702.190", "702.190a",
      "704", "704.5", "704.5k", "704.5m", "704.5n", "704.5p", "704.5aa",
    ]);
  });

  test("subrule letters skip l and o, and continue past z — none is assumed contiguous", () => {
    const index = parsed();
    for (const absent of ["704.5l", "704.5o"]) assert.equal(textOf(index, absent), undefined);
    assert.equal(textOf(index, "704.5p"), "Letter p — o is skipped.");
    assert.equal(textOf(index, "704.5aa"), "After z the letters double.");
  });

  test("headings keep their title as text", () => {
    assert.equal(textOf(parsed(), "702.19"), "Trample");
  });

  test("an Example line and an indented continuation belong to the rule above them", () => {
    const index = parsed();
    assert.equal(
      textOf(index, "702.19b"),
      "The controller assigns synthetic damage.\nExample: A synthetic 3/3 with trample is blocked by a 1/1.",
    );
    assert.equal(
      textOf(index, "702.19c"),
      "Multiple instances of trample are redundant.\nAn indented continuation line belongs to 702.19c.",
    );
  });

  test("the glossary's numbered definitions never parse as rules", () => {
    const index = parsed();
    assert.equal(textOf(index, "1"), "Game Concepts");
    assert.equal(numbers(index).includes("2"), false);
  });
});

describe("parseRules — a file that changed shape is a failure, never a partial index", () => {
  const without = (drop: (line: string) => boolean) =>
    syntheticCr(SYNTHETIC_LINES.filter((line) => !drop(line)));

  test("no effective-date line", () => {
    const r = parseRules(without((l) => l.startsWith("These rules are effective")));
    assert.ok(r.ok === false);
    assert.equal(r.error.code, "unexpected");
    assert.match(r.error.message, /effective date/i);
  });

  test("no Contents heading", () => {
    const r = parseRules(without((l) => l === "Contents"));
    assert.ok(r.ok === false);
    assert.equal(r.error.code, "unexpected");
  });

  test("an HTML page where the TXT should be", () => {
    const r = parseRules("<html><body>Access denied</body></html>");
    assert.ok(r.ok === false);
    assert.equal(r.error.code, "unexpected");
  });
});
