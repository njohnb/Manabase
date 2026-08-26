import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  classifyBump,
  levelOf,
  commitType,
  nextVersion,
  isStrictSemver,
  compareSemver,
} from "../scripts/bump-version.mjs";

// The bump parser is tested over arrays of commit subjects, never over `git log` — a test that
// shells out to the repository's history changes under it (Slice 18 testing requirement). The CLI
// body is behind a main-guard, so importing the module here never runs it.

describe("classifyBump — the range mapping (highest wins)", () => {
  test("docs/chore only -> no release", () => {
    assert.equal(classifyBump(["docs: tidy the roadmap", "chore: bump deps"]), "none");
  });

  test("a feat present anywhere -> minor", () => {
    assert.equal(classifyBump(["docs: notes", "feat: add combo_search", "chore: x"]), "minor");
  });

  test("fix without feat -> patch", () => {
    assert.equal(classifyBump(["fix: off-by-one", "docs: b"]), "patch");
  });

  test("perf -> patch", () => {
    assert.equal(classifyBump(["perf: fewer allocations"]), "patch");
  });

  test("an unprefixed subject (a merge commit) contributes nothing", () => {
    assert.equal(classifyBump(["Merge pull request #52 from njohnb/docs/x"]), "none");
  });

  test("an empty range -> no release", () => {
    assert.equal(classifyBump([]), "none");
  });

  test("a breaking marker is a major intent (the clamp lives in nextVersion)", () => {
    assert.equal(classifyBump(["feat!: rename a tool"]), "major");
    assert.equal(classifyBump(["refactor: x\n\nBREAKING CHANGE: drops a field"]), "major");
  });

  test("scoped types are recognized", () => {
    assert.equal(classifyBump(["feat(combo): add offset"]), "minor");
    assert.equal(classifyBump(["fix(http): retry once"]), "patch");
  });
});

describe("commitType / levelOf", () => {
  test("no conventional prefix -> type null", () => {
    assert.equal(commitType("Merge pull request #1").type, null);
    assert.equal(levelOf("prompt to setup card viewer project"), "none");
  });

  test("recognized no-release types map to none", () => {
    for (const t of ["docs", "chore", "ci", "test", "refactor", "style", "build", "revert"]) {
      assert.equal(levelOf(`${t}: something`), "none", `${t} should be no release`);
    }
  });
});

describe("nextVersion — arithmetic and the 0.x clamp", () => {
  test("minor and patch off a 0.x base", () => {
    assert.equal(nextVersion("0.1.1", "minor"), "0.2.0");
    assert.equal(nextVersion("0.1.1", "patch"), "0.1.2");
  });

  test("a major bump is CLAMPED to minor while the base is 0.x", () => {
    assert.equal(nextVersion("0.1.1", "major"), "0.2.0");
  });

  test("a major bump is a real major once past 0.x", () => {
    assert.equal(nextVersion("1.2.3", "major"), "2.0.0");
    assert.equal(nextVersion("1.2.3", "minor"), "1.3.0");
  });

  test("none -> null (no release)", () => {
    assert.equal(nextVersion("0.1.1", "none"), null);
  });

  test("end to end: a breaking commit on a 0.x base releases a minor", () => {
    assert.equal(nextVersion("0.1.1", classifyBump(["feat!: x"])), "0.2.0");
  });
});

describe("isStrictSemver — rejects the 0.1.01 near-miss", () => {
  test("accepts clean semver", () => {
    assert.ok(isStrictSemver("0.2.0"));
    assert.ok(isStrictSemver("1.0.0"));
    assert.ok(isStrictSemver("1.0.0-rc.1"));
  });

  test("rejects a leading zero in any component", () => {
    assert.ok(!isStrictSemver("0.1.01"));
    assert.ok(!isStrictSemver("01.0.0"));
    assert.ok(!isStrictSemver("0.01.0"));
  });

  test("rejects non-semver shapes", () => {
    assert.ok(!isStrictSemver("v0.2.0"));
    assert.ok(!isStrictSemver("0.2"));
    assert.ok(!isStrictSemver("0.2.0.0"));
  });
});

describe("compareSemver — the --check advancing guard", () => {
  test("orders by numeric core", () => {
    assert.equal(compareSemver("0.2.0", "0.1.1"), 1);
    assert.equal(compareSemver("0.1.1", "0.2.0"), -1);
    assert.equal(compareSemver("0.2.0", "0.2.0"), 0);
    assert.equal(compareSemver("1.0.0", "0.9.9"), 1);
  });

  test("ignores any prerelease/build suffix", () => {
    assert.equal(compareSemver("0.2.0-rc.1", "0.2.0"), 0);
  });

  test("a committed version equal to the newest tag is not ahead (a no-release / already-tagged case)", () => {
    assert.ok(compareSemver("0.1.1", "0.1.1") <= 0);
  });
});
