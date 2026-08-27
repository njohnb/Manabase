import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  classifyBump,
  levelOf,
  commitType,
  nextVersion,
  isStrictSemver,
  compareSemver,
  writePluginVersion,
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

describe("--pr idempotency — the tag base is what prevents a double-bump", () => {
  // --pr (like --advise) computes the next version from the NEWEST TAG, never from plugin.json's
  // current value. That is the whole reason a job re-running on every PR push is safe: the tag does
  // not move as the bump commit lands, so the same range yields the same number every time, and
  // --pr's `current === expected` guard turns the second run into a no-op. This models that
  // composition with the pure functions --pr is glue over; the CLI body is behind the main-guard.
  const subjects = ["feat: add a tool", "chore: tidy"];

  test("computing from the tag base is stable across re-runs (no double-bump)", () => {
    const tagBase = "0.3.0"; // newest tag; does NOT change when the bump commit lands on the PR
    const first = nextVersion(tagBase, classifyBump(subjects));
    assert.equal(first, "0.4.0");
    // Second run: same tag, same range -> the same number. plugin.json now carries 0.4.0, so --pr's
    // current === expected check makes it write nothing.
    assert.equal(nextVersion(tagBase, classifyBump(subjects)), first);
  });

  test("computing from plugin.json's value instead WOULD double-bump — the trap --pr avoids", () => {
    // After the first bump plugin.json = 0.4.0. If --pr used THAT as the base (as the default author
    // path deliberately does, run once per cycle) the next push would compute 0.5.0. The tag base
    // is what removes this hazard for a per-push job.
    assert.equal(nextVersion("0.4.0", classifyBump(subjects)), "0.5.0");
    assert.notEqual(
      nextVersion("0.4.0", classifyBump(subjects)),
      nextVersion("0.3.0", classifyBump(subjects)),
    );
  });

  test("a non-releasable range yields null -> --pr writes nothing", () => {
    assert.equal(nextVersion("0.3.0", classifyBump(["docs: notes", "chore: x"])), null);
  });
});

describe("writePluginVersion — the byte-preserving writer --pr commits onto the PR branch", () => {
  test("rewrites only the version value, preserving surrounding bytes, CRLF, and any $/backtick", () => {
    // The $ and backtick guard the replacement-*function* contract: a replacement string would let
    // `$&`/`` $` `` splice the file into itself. CRLF is preserved because this repo's working tree
    // is CRLF and a stream rewrite to LF reads as a whole-file diff.
    const text =
      '{\r\n  "name": "manabase-mtg",\r\n  "version": "0.3.0",\r\n  "note": "keep $& and `x`"\r\n}\r\n';
    const out = writePluginVersion(text, "0.4.0");
    assert.equal(
      out,
      '{\r\n  "name": "manabase-mtg",\r\n  "version": "0.4.0",\r\n  "note": "keep $& and `x`"\r\n}\r\n',
    );
  });

  test("writing the version the file already carries is a byte no-op (the idempotent re-run)", () => {
    const text = '{\r\n  "name": "x",\r\n  "version": "0.4.0"\r\n}\r\n';
    assert.equal(writePluginVersion(text, "0.4.0"), text);
  });
});
