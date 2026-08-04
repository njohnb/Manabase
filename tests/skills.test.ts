import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

// Slice 8's SKILL.md shipped with frontmatter that was not valid YAML: `description` and
// `when_to_use` both carried the unquoted string "Magic: The Gathering", and an unquoted YAML
// plain scalar cannot contain ": " (colon-space). The harness drops a skill whose frontmatter
// does not parse and reports nothing — `/reload-plugins`' skill count reads 0 in the working
// state too, so nothing in the harness distinguishes the two. Every static check PC-01 had
// passed against that file. These tests are the check that would have caught it.
//
// Caveat worth stating: the `yaml` package is a proxy for whatever parser the harness uses, not
// the harness itself. A file that parses here is not *proven* to load — but one that fails here
// is proven broken, which is the direction that matters.

const SKILLS_DIR = new URL("../skills", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1",
);

function findSkillFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...findSkillFiles(full));
    } else if (entry === "SKILL.md") {
      found.push(full);
    }
  }
  return found;
}

const skillFiles = findSkillFiles(SKILLS_DIR);

describe("skills — frontmatter is loadable", () => {
  test("at least one SKILL.md exists to check", () => {
    assert.ok(
      skillFiles.length > 0,
      `no SKILL.md found under ${SKILLS_DIR} — the plugin ships no skill, or the walk is wrong`,
    );
  });

  for (const file of skillFiles) {
    const raw = readFileSync(file, "utf8");
    // Tolerate CRLF: the working tree is CRLF while git blobs are LF, and the harness's
    // marketplace clone checks out CRLF under core.autocrlf=true.
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);

    test(`${file} — has a frontmatter block`, () => {
      assert.ok(
        match,
        "no --- delimited frontmatter block at the top of the file",
      );
    });

    test(`${file} — frontmatter parses as YAML`, () => {
      assert.ok(match);
      let parsed: unknown;
      assert.doesNotThrow(() => {
        parsed = parse(match[1] as string);
      }, "frontmatter is not valid YAML — the harness will drop this skill silently");
      assert.ok(
        parsed !== null && typeof parsed === "object",
        "frontmatter parsed to something other than a mapping",
      );
    });

    test(`${file} — declares a name and a description`, () => {
      assert.ok(match);
      const parsed = parse(match[1] as string) as Record<string, unknown>;
      assert.equal(
        typeof parsed["name"],
        "string",
        "frontmatter has no string `name`",
      );
      assert.equal(
        typeof parsed["description"],
        "string",
        "frontmatter has no string `description`",
      );
    });
  }
});

describe("skills — the colon-space trap", () => {
  // Regression guard for the exact defect, independent of the parser: an unquoted plain scalar
  // containing ": " is what broke Slice 8's skill.
  test("yaml rejects an unquoted scalar containing a colon-space", () => {
    assert.throws(
      () => parse("description: Magic: The Gathering cards"),
      "the parser no longer rejects this, so the tests above no longer guard the defect",
    );
  });

  test("yaml accepts the same value once quoted", () => {
    const parsed = parse('description: "Magic: The Gathering cards"') as Record<
      string,
      unknown
    >;
    assert.equal(parsed["description"], "Magic: The Gathering cards");
  });
});
