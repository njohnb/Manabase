import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type {
  SpellbookVariant,
  SpellbookVariantList,
} from "../../src/spellbook/types.ts";
import {
  SPELLBOOK_LEGALITY_KEYS,
  resolveFormat,
  toComboSummary,
} from "../../src/spellbook/combos.ts";

// Loaded at runtime rather than imported, like every other suite here: no `resolveJsonModule`,
// and identical behaviour under type stripping and under the esbuild bundle.
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
}

/** Verbatim capture: 40 variants, `count` 96. No variant here carries `requires`. */
const page1 = fixture("spellbook/variants-page1.json") as SpellbookVariantList;
/** DERIVED: the real offset=40 response truncated to 8 variants. Three of them carry `requires`. */
const page2 = fixture("spellbook/variants-page2.json") as SpellbookVariantList;

const firstOf = (list: SpellbookVariantList): SpellbookVariant => {
  const variant = list.results[0];
  assert.ok(variant, "fixture carries no variants");
  return variant;
};

/**
 * The Demonic Consultation + Thassa's Oracle combo, first in the verbatim page 1 capture. Every
 * field assertion below is against this one so a fixture refresh moves one block, not twelve.
 */
const oracleCombo = firstOf(page1);

describe("toComboSummary — the normalized shape", () => {
  test("[CAP-02 #2 shape] every field maps from the wire variant", () => {
    const summary = toComboSummary(oracleCombo, "commander");

    assert.equal(summary.id, "742-1295");
    assert.deepEqual(summary.uses, [
      {
        name: "Demonic Consultation",
        oracle_id: "9a1412db-45ad-46ea-8f12-a85d203113d8",
        quantity: 1,
        zones: ["H"],
        must_be_commander: false,
      },
      {
        name: "Thassa's Oracle",
        oracle_id: "1de1b591-a73f-4974-b507-8c63e07a0868",
        quantity: 1,
        zones: ["H"],
        must_be_commander: false,
      },
    ]);
    assert.deepEqual(summary.produces, ["Exile your library", "Win the game"]);
    assert.equal(summary.color_identity, "UB");
    assert.equal(summary.mana_needed, "{U}{U}{B}");
    assert.equal(summary.mana_value_needed, 3);
    assert.equal(summary.bracket_tag, "R");
    assert.equal(typeof summary.popularity, "number");
    assert.match(summary.description, /^Cast Demonic Consultation by paying \{B\}/);
    assert.equal(summary.legal, true);
  });

  test("`bucket` is absent unless one is passed — combo_search never sets it", () => {
    assert.equal("bucket" in toComboSummary(oracleCombo, "commander"), false);
    // Slice 17's path. The shape is set here, so the parameter is exercised here.
    assert.equal(toComboSummary(oracleCombo, "commander", "included").bucket, "included");
  });

  test("legal reads the ONE named format, and is a boolean not a string", () => {
    // Upstream reports booleans; CardSummary.legalities' "legal"/"not_legal" shape is Scryfall's
    // and must not be reused (MCP-PRD §4.4).
    assert.equal(toComboSummary(oracleCombo, "commander").legal, true);
    assert.equal(toComboSummary(oracleCombo, "standard").legal, false);
    assert.equal(toComboSummary(oracleCombo, "vintage").legal, true);
  });

  test("[CAP-02 #14 half] no other format's legality appears anywhere in the result", () => {
    // Matched as a JSON KEY, not as a substring: `must_be_commander` and the combo descriptions
    // both carry format words in prose, and the claim is that no format's legality appears as a
    // FIELD — there is one boolean, named `legal`.
    const serialized = JSON.stringify(page1.results.map((v) => toComboSummary(v, "commander")));
    for (const key of SPELLBOOK_LEGALITY_KEYS) {
      assert.equal(
        serialized.includes(`"${key}":`),
        false,
        `format key "${key}" leaked into the shaped result as a field`,
      );
    }
    // And no legality *map* survives: exactly one boolean per combo, named `legal`.
    assert.equal(serialized.includes('"legalities"'), false);
  });
});

describe("toComboSummary — the omissions that are the mechanism", () => {
  const shapedPage = JSON.stringify(page1.results.map((v) => toComboSummary(v, "commander")));

  test("[CAP-02 #6] no Commander Spellbook price field survives", () => {
    // The raw fixture carries all three, so this sweep can actually fail.
    const raw = readFileSync(
      new URL("../fixtures/spellbook/variants-page1.json", import.meta.url),
      "utf8",
    );
    for (const field of ["tcgplayer", "cardkingdom", "cardmarket", "prices"]) {
      assert.ok(raw.includes(field), `fixture no longer carries "${field}" — sweep proves nothing`);
      assert.equal(shapedPage.includes(field), false, `price field "${field}" leaked`);
    }
  });

  test("[CAP-02 #7] no imageUri field survives, case-insensitively", () => {
    const raw = readFileSync(
      new URL("../fixtures/spellbook/variants-page1.json", import.meta.url),
      "utf8",
    );
    assert.ok(raw.toLowerCase().includes("imageuri"), "fixture carries no imageUri — sweep is vacuous");
    assert.equal(shapedPage.toLowerCase().includes("imageuri"), false);
    // The verified-but-deliberately-untaken route (MCP-PRD OQ-13): no reconstructed image host.
    assert.equal(shapedPage.includes("cards.scryfall.io"), false);
  });
});

describe("toComboSummary — optional keys are absent, never undefined", () => {
  test("[requirement 10] a variant with `requires` round-trips template, quantity and zones", () => {
    // Page 1 carries none; the DERIVED page 2 carries three. Never assert counts against page 2.
    const withTemplate = page2.results.find((v) => v.requires.length > 0);
    assert.ok(withTemplate, "page 2 fixture no longer carries a templated variant");

    const summary = toComboSummary(withTemplate, "commander");
    assert.ok(summary.requires);
    assert.equal(summary.requires.length, withTemplate.requires.length);
    assert.deepEqual(summary.requires[0], {
      template: withTemplate.requires[0]!.template.name,
      quantity: withTemplate.requires[0]!.quantity,
      zones: withTemplate.requires[0]!.zoneLocations,
    });
    assert.match(summary.requires[0]!.template, /\S/);
  });

  test("[requirement 11] `requires` is omitted entirely when the combo needs no template", () => {
    assert.equal(oracleCombo.requires.length, 0);
    assert.equal("requires" in toComboSummary(oracleCombo, "commander"), false);
  });

  test("[requirement 11] prerequisites: joined, kept, or omitted", () => {
    const easyOnly = page1.results.find(
      (v) => v.easyPrerequisites !== "" && v.notablePrerequisites === "",
    );
    const notableOnly = page1.results.find(
      (v) => v.easyPrerequisites === "" && v.notablePrerequisites !== "",
    );
    assert.ok(easyOnly && notableOnly, "fixture no longer exercises both prerequisite fields");

    assert.equal(toComboSummary(easyOnly, "commander").prerequisites, easyOnly.easyPrerequisites);
    assert.equal(
      toComboSummary(notableOnly, "commander").prerequisites,
      notableOnly.notablePrerequisites,
    );

    // Both present: joined with "\n", the separator upstream already uses inside one field.
    const both: SpellbookVariant = {
      ...oracleCombo,
      easyPrerequisites: "You control a basic Island.",
      notablePrerequisites: "Your life total is at least 2.",
    };
    assert.equal(
      toComboSummary(both, "commander").prerequisites,
      "You control a basic Island.\nYour life total is at least 2.",
    );

    // Both empty — absent, not "" and not undefined.
    assert.equal(oracleCombo.easyPrerequisites, "");
    assert.equal(oracleCombo.notablePrerequisites, "");
    assert.equal("prerequisites" in toComboSummary(oracleCombo, "commander"), false);
  });

  test("[requirement 11] popularity is omitted when upstream reports null", () => {
    // No committed fixture carries a null popularity, so it is synthesized from a real variant —
    // the pattern `upstreamPage()` uses in tests/tools/card-search.test.ts.
    const noPopularity: SpellbookVariant = { ...oracleCombo, popularity: null };
    assert.equal("popularity" in toComboSummary(noPopularity, "commander"), false);
    assert.equal(toComboSummary(oracleCombo, "commander").popularity, oracleCombo.popularity);
  });

  test("a transform card shapes to one entry and carries no face data", () => {
    // Synthesized: no committed fixture carries `faces: 2`. The shaper must be indifferent to a
    // field it does not declare, and must not start emitting one.
    const base = oracleCombo.uses[0]!;
    const transform = {
      ...oracleCombo,
      uses: [{ ...base, card: { ...base.card, faces: 2, usedFace: 0 } }],
    } as unknown as SpellbookVariant;

    const summary = toComboSummary(transform, "commander");
    assert.equal(summary.uses.length, 1);
    assert.deepEqual(Object.keys(summary.uses[0]!), [
      "name", "oracle_id", "quantity", "zones", "must_be_commander",
    ]);
    assert.equal(JSON.stringify(summary).includes("faces"), false);
  });
});

describe("resolveFormat — requirement 7", () => {
  test("all 16 Commander Spellbook keys resolve to themselves", () => {
    assert.equal(SPELLBOOK_LEGALITY_KEYS.length, 16);
    for (const key of SPELLBOOK_LEGALITY_KEYS) {
      assert.equal(resolveFormat(key), key, `key "${key}" did not resolve`);
    }
  });

  test("the 16 keys are exactly what upstream returns on every fixture variant", () => {
    for (const variant of [...page1.results, ...page2.results]) {
      assert.deepEqual(
        Object.keys(variant.legalities).sort(),
        [...SPELLBOOK_LEGALITY_KEYS].sort(),
        `variant ${variant.id} carries a different legality key set`,
      );
    }
  });

  test("matching is case-insensitive and resolves to the canonical camelCase key", () => {
    assert.equal(resolveFormat("Commander"), "commander");
    assert.equal(resolveFormat("COMMANDER"), "commander");
    // The near-invisible one: standardBrawl differs from Scryfall's standardbrawl only in case.
    assert.equal(resolveFormat("standardbrawl"), "standardBrawl");
    assert.equal(resolveFormat("STANDARDBRAWL"), "standardBrawl");
    assert.equal(resolveFormat("competitivebrawl"), "competitiveBrawl");
    assert.equal(resolveFormat("paupercommandermain"), "pauperCommanderMain");
  });

  test("`edh` is the one alias, and it maps to commander", () => {
    assert.equal(resolveFormat("edh"), "commander");
    assert.equal(resolveFormat("EDH"), "commander");
  });

  test("an absent format defaults to commander", () => {
    assert.equal(resolveFormat(undefined), "commander");
  });

  test("a Scryfall key this source cannot judge is REFUSED, never mapped to commander", () => {
    // Scryfall keys absent from Commander Spellbook's 16. A fallback would answer a different
    // question than the one asked (MCP-PRD §3.6).
    for (const key of [
      "historic", "timeless", "penny", "duel", "future", "gladiator", "oldschool", "tlr",
      "notaformat", "", "   ",
    ]) {
      assert.equal(resolveFormat(key), undefined, `"${key}" should be refused`);
    }
  });
});

describe("the trim, measured", () => {
  test("a full 40-combo page stays well inside the harness ceiling", () => {
    const shaped = page1.results.map((v) => toComboSummary(v, "commander"));
    assert.equal(shaped.length, 40);

    const chars = JSON.stringify(shaped).length;

    // A BOUND, never an equality: per-combo cost varies with how many cards a combo uses, so an
    // exact assertion becomes a test that fails on a fixture refresh for no real reason.
    //
    // The bound that MATTERS is the harness ceiling: 116,626 characters is the CAP-01 response
    // that breached one in issue #25. CAP-02 also states a 50,000 page budget, but that budget is
    // NOT a guarantee and this test must not be read as proving it — page 2 of this same query
    // measured 63,688 characters live on 2026-08-25, at 1,592 characters per combo against the
    // 930-1,236 band MCP-PRD §4.4.1 records. A page stays comfortably inside the ceiling; it does
    // not stay inside 50,000.
    assert.ok(chars < 116_626, `shaped page measured ${chars} characters — at the issue #25 ceiling`);
    // Fixture-level regression guard, not a claim about live data.
    assert.ok(chars < 50_000, `shaped page 1 measured ${chars} characters`);
    assert.ok(chars / 40 < 1_400, `per-combo cost ${Math.round(chars / 40)} on this fixture`);

    // The trim is real: the raw fixture is several times the shaped form.
    const raw = readFileSync(
      new URL("../fixtures/spellbook/variants-page1.json", import.meta.url),
      "utf8",
    ).length;
    assert.ok(chars < raw * 0.35, `only trimmed to ${((100 * chars) / raw).toFixed(1)}% of raw`);
  });

  test("description is kept — it is what the model reasons from", () => {
    // MCP-PRD §4.4.1: ~40% of the trimmed form, kept for the reason OQ-02 kept oracle_text.
    for (const variant of page1.results) {
      assert.equal(toComboSummary(variant, "commander").description, variant.description);
    }
  });
});
