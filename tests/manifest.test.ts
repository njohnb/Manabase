import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { APP_VERSION } from "../src/config.ts";
import { toolDefinitions } from "../src/tools/register.ts";

// The MCPB manifest's `tools` array is a user-facing claim rendered by Claude Desktop, and it drifted
// once already (one tool declared while the server registered two). These are the checks that make
// both defects — a manifest tool list out of step with register.ts, and APP_VERSION out of step with
// package.json — fail `npm test` rather than ship silently on the next automated release (Slice 18).
//
// JSON is read at runtime with readFileSync rather than imported, so the tests behave identically
// under `--experimental-strip-types` and under the bundle.

const manifest = JSON.parse(
  readFileSync(new URL("../mcpb/manifest.json", import.meta.url), "utf8"),
) as { tools: Array<{ name: string }>; version: string };

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

describe("mcpb/manifest.json tools vs register.ts", () => {
  const registered = new Set(toolDefinitions.map((t) => t.name));
  const declared = new Set(manifest.tools.map((t) => t.name));

  // Set equality in BOTH directions, never a count — so a tool added on either side without the
  // other fails here, and the check survives PR #53 landing a third tool underneath it.
  test("every registered tool is declared in the manifest", () => {
    for (const name of registered) {
      assert.ok(declared.has(name), `manifest is missing registered tool: ${name}`);
    }
  });

  test("every manifest tool is a registered tool", () => {
    for (const name of declared) {
      assert.ok(registered.has(name), `manifest declares an unregistered tool: ${name}`);
    }
  });

  test("the two sets are the same size (no duplicates hiding a mismatch)", () => {
    assert.equal(declared.size, registered.size);
  });
});

describe("APP_VERSION is kept in sync with package.json", () => {
  // The bundle cannot read package.json at runtime, so config.ts's APP_VERSION is hand-synced. This
  // turns that hand-sync rule (Slice 13 requirement 6) into a check instead of a memory.
  test("APP_VERSION equals package.json's version", () => {
    assert.equal(APP_VERSION, pkg.version);
  });
});
