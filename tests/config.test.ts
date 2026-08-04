import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { APP_VERSION, resolveConfig } from "../src/config.ts";

describe("resolveConfig — cacheDir", () => {
  test("CLAUDE_PLUGIN_DATA set wins on win32", () => {
    const config = resolveConfig(
      { CLAUDE_PLUGIN_DATA: "C:\\plugin-data" },
      "win32",
    );
    assert.equal(config.cacheDir, "C:\\plugin-data");
  });

  test("CLAUDE_PLUGIN_DATA set wins on darwin", () => {
    const config = resolveConfig(
      { CLAUDE_PLUGIN_DATA: "/plugin-data" },
      "darwin",
    );
    assert.equal(config.cacheDir, "/plugin-data");
  });

  test("CLAUDE_PLUGIN_DATA set wins on linux", () => {
    const config = resolveConfig(
      { CLAUDE_PLUGIN_DATA: "/plugin-data" },
      "linux",
    );
    assert.equal(config.cacheDir, "/plugin-data");
  });

  test("CLAUDE_PLUGIN_DATA empty string is treated as unset", () => {
    const config = resolveConfig(
      { CLAUDE_PLUGIN_DATA: "", LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" },
      "win32",
    );
    assert.equal(config.cacheDir, "C:\\Users\\test\\AppData\\Local\\manabase");
  });

  test("win32 with LOCALAPPDATA set", () => {
    const config = resolveConfig(
      { LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" },
      "win32",
    );
    assert.equal(config.cacheDir, "C:\\Users\\test\\AppData\\Local\\manabase");
  });

  test("win32 without LOCALAPPDATA falls back to homedir", () => {
    const config = resolveConfig({}, "win32");
    assert.equal(config.cacheDir, `${homedir()}\\AppData\\Local\\manabase`);
  });

  test("darwin resolves to Library/Caches", () => {
    const config = resolveConfig({}, "darwin");
    assert.equal(config.cacheDir, `${homedir()}/Library/Caches/manabase`);
  });

  test("linux with XDG_CACHE_HOME set", () => {
    const config = resolveConfig(
      { XDG_CACHE_HOME: "/home/test/.cache" },
      "linux",
    );
    assert.equal(config.cacheDir, "/home/test/.cache/manabase");
  });

  test("linux without XDG_CACHE_HOME falls back to homedir", () => {
    const config = resolveConfig({}, "linux");
    assert.equal(config.cacheDir, `${homedir()}/.cache/manabase`);
  });

  test("undefined platform falls through to the 'other' branch", () => {
    const config = resolveConfig({}, undefined);
    assert.equal(config.cacheDir, `${homedir()}/.cache/manabase`);
  });
});

describe("resolveConfig — userAgent", () => {
  test("contains manabase-mtg/ and APP_VERSION", () => {
    const config = resolveConfig({}, "linux");
    assert.ok(config.userAgent.includes("manabase-mtg/"));
    assert.ok(config.userAgent.includes(APP_VERSION));
  });
});

describe("resolveConfig — scryfallBaseUrl", () => {
  test("is the production Scryfall API base URL", () => {
    const config = resolveConfig({}, "linux");
    assert.equal(config.scryfallBaseUrl, "https://api.scryfall.com");
  });
});
