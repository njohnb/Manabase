import type { Config } from "../config.ts";
import type { Failure, FailureCode, Result } from "../result.ts";

export interface ClientDeps {
  fetchImpl?: typeof fetch;                 // default: globalThis.fetch
  now?: () => number;                       // default: Date.now
  sleep?: (ms: number) => Promise<void>;    // default: setTimeout wrapper
}

export interface ScryfallClient {
  /** GET config.scryfallBaseUrl + path. Never throws. */
  get(path: string, query?: Record<string, string | undefined>): Promise<Result<unknown>>;
}

type Lane = { tail: Promise<void>; nextAllowedAt: number };
type Attempt = { throttled: true; response: Response } | { throttled: false; result: Result<unknown> };

// (MCP-PRD §3.4) card-search-family endpoints are limited to 2/sec; everything else to 10/sec.
const CARD_PATH_PREFIXES = ["/cards/search", "/cards/named", "/cards/random", "/cards/collection"];

function isCardPath(path: string): boolean {
  return CARD_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.append(key, value);
    }
  }
  const qs = params.toString();
  return qs.length > 0 ? `${baseUrl}${path}?${qs}` : `${baseUrl}${path}`;
}

// (exactOptionalPropertyTypes) build the error object conditionally — never assign `undefined`
// to an optional property.
function fail(code: FailureCode, message: string, status?: number, details?: string): Failure {
  const error: Failure["error"] = { code, message };
  if (status !== undefined) error.status = status;
  if (details !== undefined) error.details = details;
  return { ok: false, error };
}

function rateLimitedFailure(details?: string): Failure {
  return fail(
    "rate_limited",
    "Scryfall rate limit persisted after a 30 second backoff; wait at least 30 seconds before retrying.",
    429,
    details,
  );
}

interface ScryfallErrorBody {
  object?: string;
  status?: number;
  code?: string;
  details?: string;
  warnings?: string[];
}

function detailsFrom(text: string): string | undefined {
  try {
    const body = JSON.parse(text) as ScryfallErrorBody;
    return typeof body.details === "string" ? body.details : undefined;
  } catch {
    return undefined; // unparseable body — mapped code survives, details omitted
  }
}

async function mapResponse(response: Response): Promise<Result<unknown>> {
  const status = response.status;
  const text = await response.text();

  if (status >= 200 && status < 300) {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch {
      return fail("unexpected", `Scryfall returned a non-JSON success body (status ${status}).`, status);
    }
  }

  const details = detailsFrom(text);

  if (status === 400) return fail("bad_request", "Scryfall rejected the request as malformed.", status, details);
  if (status === 404) return fail("not_found", "Scryfall found no match for the request.", status, details);
  if (status >= 500 && status <= 599) {
    return fail("upstream_unavailable", "Scryfall is currently unavailable.", status, details);
  }
  return fail("unexpected", `Scryfall returned an unexpected status ${status}.`, status, details);
}

export function createScryfallClient(config: Config, deps?: ClientDeps): ScryfallClient {
  const fetchImpl = deps?.fetchImpl ?? globalThis.fetch;
  const now = deps?.now ?? Date.now;
  const sleep = deps?.sleep ?? ((ms: number) => new Promise<void>((r) => { setTimeout(r, ms); }));

  const lanes = {
    card: { tail: Promise.resolve(), nextAllowedAt: 0 } as Lane,
    other: { tail: Promise.resolve(), nextAllowedAt: 0 } as Lane,
  };

  async function attemptOnce(url: string): Promise<Attempt> {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: { "User-Agent": config.userAgent, "Accept": "application/json" },
      });
    } catch (err) {
      return { throttled: false, result: fail("network", `Could not reach Scryfall: ${describe(err)}`) };
    }
    if (response.status === 429) return { throttled: true, response };
    return { throttled: false, result: await mapResponse(response) };
  }

  async function run(path: string, query?: Record<string, string | undefined>): Promise<Result<unknown>> {
    const url = buildUrl(config.scryfallBaseUrl, path, query);
    const lane = isCardPath(path) ? lanes.card : lanes.other;
    const spacingMs = lane === lanes.card ? 500 : 100;

    const previous = lane.tail;                  // synchronous prefix (before any await):
    let release: () => void = () => {};           // concurrent get()s enqueue in call order,
    lane.tail = new Promise((r) => { release = r; }); // making Promise.all tests deterministic
    await previous;                               // never rejects (release lives in finally)
    try {
      const wait = lane.nextAllowedAt - now();
      if (wait > 0) await sleep(wait);            // sleep only when strictly positive
      lane.nextAllowedAt = now() + spacingMs;      // stamp BEFORE fetch (limit is on request starts)
      let attempt = await attemptOnce(url);
      if (attempt.throttled) {
        await sleep(30_000);                      // (MCP-PRD §3.4)
        lane.nextAllowedAt = now() + spacingMs;    // RESTAMP: spacing relative to the retry
        attempt = await attemptOnce(url);
        if (attempt.throttled) {
          // A persisted 429 locks the caller out ~30 s — write that into lane state so a
          // queued request doesn't fire into the lockout window. (MCP-PRD §3.4)
          lane.nextAllowedAt = now() + 30_000;
          const text = await attempt.response.text().catch(() => "");
          return rateLimitedFailure(detailsFrom(text));
        }
      }
      return attempt.result;
    } finally {
      release();                                  // lane held for the whole request incl. backoff
    }
  }

  async function get(path: string, query?: Record<string, string | undefined>): Promise<Result<unknown>> {
    try {
      return await run(path, query);
    } catch (err) {
      // (MCP-PRD D-10) backstop — never a rethrow
      return fail("unexpected", `Unexpected failure in Scryfall client: ${describe(err)}`);
    }
  }

  return { get };
}
