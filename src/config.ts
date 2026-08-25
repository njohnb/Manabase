import { homedir } from "node:os";

// Keep in sync with package.json's "version" — the build is a bundle, so
// this cannot be read from package.json at runtime.
export const APP_VERSION = "0.0.0";

export interface Config {
  /** Sent on every outbound request. Names the app per Scryfall's requirement. */
  userAgent: string;
  /** CLAUDE_PLUGIN_DATA when set; otherwise the platform user-cache dir. Unused until a capability needs persistence. */
  cacheDir: string;
  /** "https://api.scryfall.com" in production; overridable so tests never hit the network. */
  scryfallBaseUrl: string;
  /** "https://backend.commanderspellbook.com"; read by nothing until CAP-02 ships. */
  spellbookBaseUrl: string;
}

export function resolveConfig(
  env: Record<string, string | undefined>,
  platform?: string, // defaults to process.platform; injectable for tests
): Config {
  const userAgent = `manabase-mtg/${APP_VERSION} (+https://github.com/njohnb/manabase)`;
  const scryfallBaseUrl = "https://api.scryfall.com";
  const spellbookBaseUrl = "https://backend.commanderspellbook.com";

  return {
    userAgent,
    cacheDir: resolveCacheDir(env, platform),
    scryfallBaseUrl,
    spellbookBaseUrl,
  };
}

function resolveCacheDir(
  env: Record<string, string | undefined>,
  platform: string | undefined,
): string {
  if (env.CLAUDE_PLUGIN_DATA !== undefined && env.CLAUDE_PLUGIN_DATA !== "") {
    return env.CLAUDE_PLUGIN_DATA;
  }

  if (platform === "win32") {
    const localAppData = env.LOCALAPPDATA;
    if (localAppData !== undefined && localAppData !== "") {
      return `${localAppData}\\manabase`;
    }
    return `${homedir()}\\AppData\\Local\\manabase`;
  }

  if (platform === "darwin") {
    return `${homedir()}/Library/Caches/manabase`;
  }

  const xdgCacheHome = env.XDG_CACHE_HOME;
  if (xdgCacheHome !== undefined && xdgCacheHome !== "") {
    return `${xdgCacheHome}/manabase`;
  }
  return `${homedir()}/.cache/manabase`;
}
