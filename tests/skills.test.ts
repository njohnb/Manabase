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

// PLUGIN-PRD P-12 (as amended by P-14): the scoped tool name is built per surface —
// `mcp__plugin_manabase_mtg__card_search` in Claude Code, `Manabase:card_search` via MCPB — and
// is not a property of the server. A skill travels to every surface, so a scoped string written
// into one is wrong on at least one of them, and a skill that tests for it reports "absent" where
// the tool works. Skills name tools in plain words ("the rules lookup tool") and skills by bare
// name. Covers every markdown file under skills/, reference files included.
const SCOPED_TOOL_NAME = /mcp__[a-z0-9_]+|\bManabase:[a-z_]+/g;

function scopedToolNames(text: string): string[] {
  return text.match(SCOPED_TOOL_NAME) ?? [];
}

function findMarkdownFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...findMarkdownFiles(full));
    } else if (entry.endsWith(".md")) {
      found.push(full);
    }
  }
  return found;
}

describe("skills — no scoped tool string", () => {
  test("the detector flags both surfaces' scoped forms and passes a bare name", () => {
    assert.deepEqual(scopedToolNames("call mcp__plugin_manabase_mtg__rules_lookup now"), [
      "mcp__plugin_manabase_mtg__rules_lookup",
    ]);
    assert.deepEqual(scopedToolNames("call Manabase:card_rulings now"), ["Manabase:card_rulings"]);
    assert.deepEqual(scopedToolNames("call the rules lookup tool (`rules_lookup`)"), []);
  });

  for (const file of findMarkdownFiles(SKILLS_DIR)) {
    test(`${file} — names no scoped tool string`, () => {
      assert.deepEqual(scopedToolNames(readFileSync(file, "utf8")), []);
    });
  }
});

describe("skills — the rules skill ships (PLUGIN-PRD PC-06)", () => {
  const rulesSkill = skillFiles.find((f) => /[\\/]mtg-rules[\\/]SKILL\.md$/.test(f));

  test("skills/mtg-rules/SKILL.md exists and is named mtg-rules", () => {
    assert.ok(rulesSkill, "no skills/mtg-rules/SKILL.md");
    const match = readFileSync(rulesSkill, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(match);
    const parsed = parse(match[1] as string) as Record<string, unknown>;
    assert.equal(parsed["name"], "mtg-rules");
  });

  test("the combo skill points rules questions at it by name", () => {
    const combo = skillFiles.find((f) => /[\\/]spellbook-combo-craft[\\/]SKILL\.md$/.test(f));
    assert.ok(combo);
    assert.match(readFileSync(combo, "utf8"), /`mtg-rules`/);
  });

  test("the deck skill points rules questions at it by name", () => {
    const deck = skillFiles.find((f) => /[\\/]commander-deck-ratios[\\/]SKILL\.md$/.test(f));
    assert.ok(deck);
    assert.match(readFileSync(deck, "utf8"), /`mtg-rules`/);
  });
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
