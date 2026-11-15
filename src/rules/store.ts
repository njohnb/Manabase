import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { HttpClient } from "../http/client.ts";
import type { Failure, Result } from "../result.ts";
import { parseRules } from "./parser.ts";
import type { RulesIndex } from "./parser.ts";
import { resolveCrSource } from "./source.ts";

/** The two filesystem operations the store needs. Injected (MCP-PRD D-03). */
export interface RulesFs {
  /** The file's text, or undefined when it cannot be read for any reason. */
  readText(path: string): Promise<string | undefined>;
  /** Writes the file, creating its directory. May reject. */
  writeText(path: string, text: string): Promise<void>;
}

export interface RulesStoreDeps {
  /** Text client on `siteBaseUrl` — the landing page. */
  site: HttpClient;
  /** Text client on `mediaBaseUrl` — the dated files. */
  media: HttpClient;
  siteBaseUrl: string;
  mediaBaseUrl: string;
  fs: RulesFs;
  now: () => number;
  /** The resolved cache directory from `config.ts` (MCP-PRD OQ-03's shipped location half). */
  cacheDir: string;
}

export interface CachedRules {
  index: RulesIndex;
  /** The dated PDF, else the TXT. */
  citationUrl: string;
  /** Epoch ms of the download this index came from — the cache's age, not this call's. */
  fetchedAt: number;
}

interface CacheMeta {
  dateStamp: string;
  txtUrl: string;
  citationUrl: string;
  fetchedAt: string;
}

export const LANDING_PATH = "/en/rules";

/** Node's filesystem behind `RulesFs`. The only production implementation. */
export const nodeRulesFs: RulesFs = {
  readText: (path) => readFile(path, "utf8").catch(() => undefined),
  writeText: async (path, text) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text, "utf8");
  },
};

function paths(cacheDir: string) {
  const dir = join(cacheDir, "rules");
  return { txt: join(dir, "cr.txt"), meta: join(dir, "meta.json") };
}

function readMeta(text: string | undefined): CacheMeta | undefined {
  if (text === undefined) return undefined;
  try {
    const meta = JSON.parse(text) as Partial<CacheMeta>;
    if (typeof meta.citationUrl !== "string" || typeof meta.fetchedAt !== "string") return undefined;
    if (!Number.isFinite(Date.parse(meta.fetchedAt))) return undefined;
    return meta as CacheMeta;
  } catch {
    return undefined;
  }
}

async function fromCache(deps: RulesStoreDeps): Promise<CachedRules | undefined> {
  const { txt, meta } = paths(deps.cacheDir);
  const cachedMeta = readMeta(await deps.fs.readText(meta));
  if (cachedMeta === undefined) return undefined;
  const text = await deps.fs.readText(txt);
  if (text === undefined) return undefined;
  const parsed = parseRules(text);
  if (!parsed.ok) return undefined; // a damaged cache is no cache: download again
  return { index: parsed.value, citationUrl: cachedMeta.citationUrl, fetchedAt: Date.parse(cachedMeta.fetchedAt) };
}

/** Prefixes the context, and says plainly when Wizards refused an honestly identified caller. */
function downloadFailure(failure: Failure): Failure {
  const refused = failure.error.status === 401 || failure.error.status === 403;
  const message =
    `Could not download the Comprehensive Rules: ${failure.error.message}` +
    (refused
      ? " Wizards of the Coast refused the request. That is reported, not worked around (MCP-PRD §3.7)."
      : "");
  return { ok: false, error: { ...failure.error, message } };
}

async function download(deps: RulesStoreDeps): Promise<Result<CachedRules>> {
  const page = await deps.site.get(LANDING_PATH);
  if (!page.ok) return downloadFailure(page);
  if (typeof page.value !== "string") {
    return { ok: false, error: { code: "unexpected", message: "The Wizards rules page returned no text body." } };
  }

  const source = resolveCrSource(page.value, `${deps.siteBaseUrl}${LANDING_PATH}`);
  if (!source.ok) return source;

  // The media client takes a PATH on its own host. A TXT that moved elsewhere is a changed page,
  // and is reported rather than followed to a host this server was never configured to call.
  const txtUrl = new URL(source.value.txtUrl);
  if (txtUrl.origin !== new URL(deps.mediaBaseUrl).origin) {
    return {
      ok: false,
      error: {
        code: "unexpected",
        message:
          `The Wizards rules page points the Comprehensive Rules at ${txtUrl.origin}, not ` +
          `${deps.mediaBaseUrl}. The page may have changed; the file was not fetched.`,
      },
    };
  }

  const file = await deps.media.get(txtUrl.pathname);
  if (!file.ok) return downloadFailure(file);
  if (typeof file.value !== "string") {
    return { ok: false, error: { code: "unexpected", message: "The Comprehensive Rules download returned no text body." } };
  }

  const parsed = parseRules(file.value);
  if (!parsed.ok) return parsed; // nothing is cached from a file that does not parse

  const fetchedAt = deps.now();
  const meta: CacheMeta = {
    dateStamp: source.value.dateStamp,
    txtUrl: source.value.txtUrl,
    citationUrl: source.value.citationUrl,
    fetchedAt: new Date(fetchedAt).toISOString(),
  };
  const { txt, meta: metaPath } = paths(deps.cacheDir);
  try {
    // TXT first, metadata last: metadata without its TXT is not treated as a cache.
    await deps.fs.writeText(txt, file.value);
    await deps.fs.writeText(metaPath, JSON.stringify(meta));
  } catch {
    // A disk that refuses the write costs the cache, not this answer.
  }
  return { ok: true, value: { index: parsed.value, citationUrl: source.value.citationUrl, fetchedAt } };
}

/**
 * The Comprehensive Rules, from the cache when present, else downloaded once from Wizards and
 * cached (MCP-PRD D-08: fetched at runtime on the user's machine, never bundled). Never throws.
 *
 * First use blocks on that one download. Revalidation against a newer landing-page stamp, and
 * serving a stale cache when Wizards is unreachable, are not built here.
 */
export async function ensureRules(deps: RulesStoreDeps): Promise<Result<CachedRules>> {
  try {
    const cached = await fromCache(deps);
    if (cached !== undefined) return { ok: true, value: cached };
    return await download(deps);
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "unexpected",
        message: `Unexpected failure loading the Comprehensive Rules: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
}
