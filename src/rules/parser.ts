import type { Result } from "../result.ts";

/** One numbered line of the Comprehensive Rules, with any lines that continue it. */
export interface RuleEntry {
  /** Canonical: no trailing period — `"7"`, `"702"`, `"702.19"`, `"702.19a"`. */
  number: string;
  /** Example lines and indented continuations are joined with `\n`. */
  text: string;
}

export interface RulesIndex {
  /** ISO `YYYY-MM-DD`, read from the document's own "effective as of" line. */
  effectiveDate: string;
  /** Every rule in document order. Descendants of a rule follow it contiguously. */
  rules: RuleEntry[];
  /** `number` → position in `rules`. */
  positions: Map<string, number>;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const EFFECTIVE = /effective as of ([A-Z][a-z]+) (\d{1,2}), (\d{4})/;

/**
 * A rule line: section `7.`, rule `702.`, rule `702.19.`, subrule `702.19a` (the real file also
 * carries `119.1d.` with a stray period, and `704.5aa` once the letters pass `z`). Subrule letters
 * are matched as any run of lowercase letters, never as a contiguous sequence: the CR skips `l` and
 * `o` (MCP-PRD §4.6).
 */
const RULE_LINE = /^(\d{1,3}(?:\.\d+[a-z]*)?)\.?\s+(\S.*)$/;

function shapeChanged(what: string): Result<RulesIndex> {
  return {
    ok: false,
    error: {
      code: "unexpected",
      message:
        `The downloaded Comprehensive Rules did not parse: ${what}. The file may have changed ` +
        "shape; nothing was cached from it.",
    },
  };
}

/**
 * Raw CR TXT in, an index out. Pure.
 *
 * The file opens with a contents section that repeats every section and rule heading, so the
 * body is taken from after the contents' closing "Credits" line to the body's own "Glossary"
 * heading. Stopping there matters: glossary definitions are numbered `1.`, `2.`, which would
 * otherwise parse as sections.
 */
export function parseRules(raw: string): Result<RulesIndex> {
  const lines = raw.replace(/^﻿/, "").split(/\r?\n/);

  const date = EFFECTIVE.exec(lines.slice(0, 20).join("\n"));
  const month = date === null ? -1 : MONTHS.indexOf(date[1]!);
  if (date === null || month < 0) return shapeChanged("no effective date (\"effective as of …\") near the top");
  const effectiveDate =
    `${date[3]}-${String(month + 1).padStart(2, "0")}-${date[2]!.padStart(2, "0")}`;

  const trimmed = lines.map((line) => line.trim());
  const contents = trimmed.indexOf("Contents");
  if (contents < 0) return shapeChanged("no Contents heading");
  const contentsEnd = trimmed.indexOf("Credits", contents);
  if (contentsEnd < 0) return shapeChanged("the Contents section never ends");
  const bodyEnd = trimmed.indexOf("Glossary", contentsEnd);
  if (bodyEnd < 0) return shapeChanged("no Glossary heading after the rules");

  const rules: RuleEntry[] = [];
  const positions = new Map<string, number>();
  for (const line of trimmed.slice(contentsEnd + 1, bodyEnd)) {
    if (line === "") continue;
    const match = RULE_LINE.exec(line);
    if (match !== null && !positions.has(match[1]!)) {
      positions.set(match[1]!, rules.length);
      rules.push({ number: match[1]!, text: match[2]! });
      continue;
    }
    const previous = rules.at(-1);
    if (previous !== undefined) previous.text += `\n${line}`;
  }

  if (rules.length === 0) return shapeChanged("no numbered rules between the contents and the glossary");
  return { ok: true, value: { effectiveDate, rules, positions } };
}
