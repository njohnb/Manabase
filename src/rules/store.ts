import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { HttpClient } from "../http/client.ts";
import type { Failure, Result } from "../result.ts";
import { parseRules } from "./parser.ts";
import type { RulesIndex } from "./parser.ts";
import { resolveCrSource } from "./source.ts";
import type { CrSource } from "./source.ts";

/** The filesystem operations the store needs. Injected (MCP-PRD D-03). */
export interface RulesFs {
  /** The file's text, or undefined when it cannot be read for any reason. */
  readText(path: string): Promise<string | undefined>;
  /** Writes the file, creating its directory. May reject, and may leave a partial file behind. */
  writeText(path: string, text: string): Promise<void>;
  /** Deletes the file. Best effort: may reject. */
  remove(path: string): Promise<void>;
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
  /** Epoch ms the landing page last confirmed this copy current (the download counts). */
  checkedAt: number;
  /**
   * True when the copy was due a check and the check or the re-download failed, so it is served
   * as it stands. A success, never a failure (MCP-PRD CAP-04).
   */
  stale: boolean;
  /** Why the copy is stale. Present only when `stale`. */
  staleReason?: string;
}

interface CacheMeta {
  dateStamp: string;
  txtUrl: string;
  citationUrl: string;
  fetchedAt: string;
  /** Absent in a cache written before revalidation existed; `fetchedAt` stands in. */
  checkedAt?: string;
  /**
   * The TXT's file name under `<cacheDir>/rules/`, one per date stamp. Absent in a cache written
   * before revalidation existed, whose TXT is `cr.txt`.
   */
  txtFile?: string;
}

/** A parsed cache: the rules plus the metadata a revalidation needs. */
interface Cached {
  rules: CachedRules;
  meta: CacheMeta;
}

/** The landing page is re-checked at most this often (MCP-PRD OQ-03, CAP-04). */
export const REVALIDATE_AFTER_MS = 7 * 86_400_000;

export const LANDING_PATH = "/en/rules";

/**
 * Node's filesystem behind `RulesFs`. The only production implementation. Writes go to a
 * sibling temporary file renamed into place, so a killed process or a full disk leaves the old
 * file whole rather than a torn one.
 */
export const nodeRulesFs: RulesFs = {
  readText: (path) => readFile(path, "utf8").catch(() => undefined),
  writeText: async (path, text) => {
    await mkdir(dirname(path), { recursive: true });
    const temp = `${path}.${process.pid}.tmp`;
    try {
      await writeFile(temp, text, "utf8");
      await rename(temp, path);
    } catch (err) {
      await rm(temp, { force: true }).catch(() => undefined);
      throw err;
    }
  },
  remove: (path) => rm(path, { force: true }),
};

const LEGACY_TXT = "cr.txt";
const TXT_FILE = /^cr(-\d{8})?\.txt$/;

function rulesDir(cacheDir: string): string {
  return join(cacheDir, "rules");
}

function metaPath(cacheDir: string): string {
  return join(rulesDir(cacheDir), "meta.json");
}

/** One TXT per date stamp, so a new version never overwrites the copy being served. */
function txtFileFor(dateStamp: string): string {
  return `cr-${dateStamp}.txt`;
}

function readMeta(text: string | undefined): CacheMeta | undefined {
  if (text === undefined) return undefined;
  try {
    const meta = JSON.parse(text) as Partial<CacheMeta>;
    if (typeof meta.citationUrl !== "string" || typeof meta.fetchedAt !== "string") return undefined;
    if (!Number.isFinite(Date.parse(meta.fetchedAt))) return undefined;
    // The name is joined to a path, so only this store's own names are honoured.
    if (meta.txtFile !== undefined && !TXT_FILE.test(meta.txtFile)) return undefined;
    return meta as CacheMeta;
  } catch {
    return undefined;
  }
}

async function fromCache(deps: RulesStoreDeps): Promise<Cached | undefined> {
  const cachedMeta = readMeta(await deps.fs.readText(metaPath(deps.cacheDir)));
  if (cachedMeta === undefined) return undefined;
  const text = await deps.fs.readText(join(rulesDir(deps.cacheDir), cachedMeta.txtFile ?? LEGACY_TXT));
  if (text === undefined) return undefined;
  const parsed = parseRules(text);
  if (!parsed.ok) return undefined; // a damaged cache is no cache: download again
  const fetchedAt = Date.parse(cachedMeta.fetchedAt);
  const checked = cachedMeta.checkedAt !== undefined ? Date.parse(cachedMeta.checkedAt) : NaN;
  return {
    meta: cachedMeta,
    rules: {
      index: parsed.value,
      citationUrl: cachedMeta.citationUrl,
      fetchedAt,
      checkedAt: Number.isFinite(checked) ? checked : fetchedAt,
      stale: false,
    },
  };
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

/** One GET of the landing page, read into the current dated source. */
async function readLanding(deps: RulesStoreDeps): Promise<Result<CrSource>> {
  const page = await deps.site.get(LANDING_PATH);
  if (!page.ok) return downloadFailure(page);
  if (typeof page.value !== "string") {
    return { ok: false, error: { code: "unexpected", message: "The Wizards rules page returned no text body." } };
  }
  return resolveCrSource(page.value, `${deps.siteBaseUrl}${LANDING_PATH}`);
}

async function download(deps: RulesStoreDeps): Promise<Result<CachedRules>> {
  const source = await readLanding(deps);
  if (!source.ok) return source;
  return fetchFile(deps, source.value);
}

/** Downloads, parses and caches the TXT the landing page named. */
async function fetchFile(
  deps: RulesStoreDeps,
  source: CrSource,
  /** The cache this download replaces, whose TXT is removed once the switch is made. */
  previous?: CacheMeta,
): Promise<Result<CachedRules>> {
  // The media client takes a PATH on its own host. A TXT that moved elsewhere is a changed page,
  // and is reported rather than followed to a host this server was never configured to call.
  const txtUrl = new URL(source.txtUrl);
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
  const txtFile = txtFileFor(source.dateStamp);
  const meta: CacheMeta = {
    dateStamp: source.dateStamp,
    txtUrl: source.txtUrl,
    citationUrl: source.citationUrl,
    fetchedAt: new Date(fetchedAt).toISOString(),
    checkedAt: new Date(fetchedAt).toISOString(),
    txtFile,
  };
  const dir = rulesDir(deps.cacheDir);
  let switched = false;
  try {
    // The new TXT goes to its own file and the metadata is switched to it LAST, so a write that
    // fails or tears part-way leaves the metadata still naming the old, whole copy.
    await deps.fs.writeText(join(dir, txtFile), file.value);
    await deps.fs.writeText(metaPath(deps.cacheDir), JSON.stringify(meta));
    switched = true;
  } catch {
    // A disk that refuses the write costs the cache, not this answer.
  }
  const replaced = previous?.txtFile ?? (previous !== undefined ? LEGACY_TXT : undefined);
  if (switched && replaced !== undefined && replaced !== txtFile) {
    await deps.fs.remove(join(dir, replaced)).catch(() => undefined); // tidiness, never correctness
  }
  return {
    ok: true,
    value: { index: parsed.value, citationUrl: source.citationUrl, fetchedAt, checkedAt: fetchedAt, stale: false },
  };
}

/**
 * The cached copy as it stands, because a due check or re-download failed. A success: the rules
 * are still answerable, and `stale` plus the copy's own dates say how old the answer is. The
 * check time does not move, so the next call tries again.
 */
function staleCopy(cached: Cached, failure: Failure): Result<CachedRules> {
  return { ok: true, value: { ...cached.rules, stale: true, staleReason: failure.error.message } };
}

/**
 * The cached copy is due a check: read the landing page, and re-download only when its stamp
 * moved. An unchanged stamp just records the check time.
 */
async function revalidate(deps: RulesStoreDeps, cached: Cached): Promise<Result<CachedRules>> {
  const source = await readLanding(deps);
  if (!source.ok) return staleCopy(cached, source);
  if (source.value.dateStamp !== cached.meta.dateStamp) {
    const fresh = await fetchFile(deps, source.value, cached.meta);
    return fresh.ok ? fresh : staleCopy(cached, fresh);
  }

  const checkedAt = deps.now();
  const meta: CacheMeta = { ...cached.meta, checkedAt: new Date(checkedAt).toISOString() };
  try {
    await deps.fs.writeText(metaPath(deps.cacheDir), JSON.stringify(meta));
  } catch {
    // An unrecorded check costs one more check next call, not this answer.
  }
  return { ok: true, value: { ...cached.rules, checkedAt } };
}

/**
 * The Comprehensive Rules, from the cache when present, else downloaded once from Wizards and
 * cached (MCP-PRD D-08: fetched at runtime on the user's machine, never bundled). Never throws.
 *
 * First use blocks on that one download, and fails structurally when it cannot be made. After
 * that, a copy last checked fewer than seven days ago is served with no request; an older one is
 * revalidated against the landing page's date stamp, re-downloaded only when the stamp moved, and
 * served `stale` when the check or the download fails. Only a `rules_lookup` call reaches this —
 * never startup, never a hook (PLUGIN-PRD PQ-03).
 */
export async function ensureRules(deps: RulesStoreDeps): Promise<Result<CachedRules>> {
  try {
    const cached = await fromCache(deps);
    if (cached === undefined) return await download(deps);
    if (deps.now() - cached.rules.checkedAt < REVALIDATE_AFTER_MS) return { ok: true, value: cached.rules };
    return await revalidate(deps, cached);
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
