import type { Failure, FailureCode, Result } from "../result.ts";

export interface ClientDeps {
  fetchImpl?: typeof fetch;                 // default: globalThis.fetch
  now?: () => number;                       // default: Date.now
  sleep?: (ms: number) => Promise<void>;    // default: setTimeout wrapper
}

/**
 * One rate-limit queue. A lane with no `pathPrefixes` is reachable only as
 * `SourceSpec.defaultLane`.
 */
export interface LaneSpec {
  spacingMs: number;
  pathPrefixes?: readonly string[];
}

/** Everything about a source that the transport itself does not know. */
export interface SourceSpec {
  /** Interpolated into every message this client produces. */
  sourceName: string;
  baseUrl: string;
  userAgent: string;
  /** First lane one of whose `pathPrefixes` the path starts with wins, in declaration order. */
  lanes: Readonly<Record<string, LaneSpec>>;
  /** Must be a key of `lanes`. Serves every path no lane claims. */
  defaultLane: string;
  /** Reads a source's own error text out of a non-2xx body. Must never throw. */
  detailsFrom: (text: string) => string | undefined;
}

export interface HttpClient {
  /** GET spec.baseUrl + path. Never throws. */
  get(path: string, query?: Record<string, string | undefined>): Promise<Result<unknown>>;
  /** POST `body` as JSON to spec.baseUrl + path. Never throws. */
  post(path: string, body: unknown, query?: Record<string, string | undefined>): Promise<Result<unknown>>;
}

type Lane = { tail: Promise<void>; nextAllowedAt: number };
type LaneRuntime = { state: Lane; spacingMs: number; pathPrefixes: readonly string[] };
type Attempt = { throttled: true; response: Response } | { throttled: false; result: Result<unknown> };

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

function rateLimitedFailure(sourceName: string, details?: string): Failure {
  return fail(
    "rate_limited",
    `${sourceName} rate limit persisted after a 30 second backoff; wait at least 30 seconds before retrying.`,
    429,
    details,
  );
}

async function mapResponse(spec: SourceSpec, response: Response): Promise<Result<unknown>> {
  const status = response.status;
  const text = await response.text();
  const name = spec.sourceName;

  if (status >= 200 && status < 300) {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch {
      return fail("unexpected", `${name} returned a non-JSON success body (status ${status}).`, status);
    }
  }

  const details = spec.detailsFrom(text);

  if (status === 400) return fail("bad_request", `${name} rejected the request as malformed.`, status, details);
  if (status === 404) return fail("not_found", `${name} found no match for the request.`, status, details);
  if (status >= 500 && status <= 599) {
    return fail("upstream_unavailable", `${name} is currently unavailable.`, status, details);
  }
  return fail("unexpected", `${name} returned an unexpected status ${status}.`, status, details);
}

export function createHttpClient(spec: SourceSpec, deps?: ClientDeps): HttpClient {
  const fetchImpl = deps?.fetchImpl ?? globalThis.fetch;
  const now = deps?.now ?? Date.now;
  const sleep = deps?.sleep ?? ((ms: number) => new Promise<void>((r) => { setTimeout(r, ms); }));

  // One state object per declared lane, held in this closure: two clients over two hosts cannot
  // throttle each other, however many times this factory is called.
  const lanes = Object.entries(spec.lanes).map(([key, laneSpec]) => ({
    key,
    runtime: {
      state: { tail: Promise.resolve(), nextAllowedAt: 0 } as Lane,
      spacingMs: laneSpec.spacingMs,
      pathPrefixes: laneSpec.pathPrefixes ?? [],
    } satisfies LaneRuntime,
  }));

  const declaredFallback = lanes.find((lane) => lane.key === spec.defaultLane)?.runtime;
  if (declaredFallback === undefined) {
    // Construction-time programming error, not a request failure: a defaultLane naming no lane
    // would route every unclaimed path nowhere. Handlers still never throw (D-10).
    throw new Error(`createHttpClient: defaultLane "${spec.defaultLane}" is not a key of lanes.`);
  }
  const fallback: LaneRuntime = declaredFallback;

  /** First prefix match in declaration order, else the default lane. Never an identity test. */
  function selectLane(path: string): LaneRuntime {
    for (const lane of lanes) {
      if (lane.runtime.pathPrefixes.some((prefix) => path.startsWith(prefix))) return lane.runtime;
    }
    return fallback;
  }

  function baseHeaders(): Record<string, string> {
    // (MCP-PRD §3.4, §3.7) both are required on every outbound request, every source.
    return { "User-Agent": spec.userAgent, "Accept": "application/json" };
  }

  async function attemptOnce(url: string, init: RequestInit): Promise<Attempt> {
    let response: Response;
    try {
      response = await fetchImpl(url, init);
    } catch (err) {
      return {
        throttled: false,
        result: fail("network", `Could not reach ${spec.sourceName}: ${describe(err)}`),
      };
    }
    if (response.status === 429) return { throttled: true, response };
    return { throttled: false, result: await mapResponse(spec, response) };
  }

  // GET and POST share this body verbatim — a verb that skips the queue is a verb that is not
  // rate-limited.
  async function run(
    path: string,
    init: RequestInit,
    query?: Record<string, string | undefined>,
  ): Promise<Result<unknown>> {
    const url = buildUrl(spec.baseUrl, path, query);
    const { state: lane, spacingMs } = selectLane(path);

    const previous = lane.tail;                  // synchronous prefix (before any await):
    let release: () => void = () => {};           // concurrent calls enqueue in call order,
    lane.tail = new Promise((r) => { release = r; }); // making Promise.all tests deterministic
    await previous;                               // never rejects (release lives in finally)
    try {
      const wait = lane.nextAllowedAt - now();
      if (wait > 0) await sleep(wait);            // sleep only when strictly positive
      lane.nextAllowedAt = now() + spacingMs;      // stamp BEFORE fetch (limit is on request starts)
      let attempt = await attemptOnce(url, init);
      if (attempt.throttled) {
        await sleep(30_000);                      // (MCP-PRD §3.4)
        lane.nextAllowedAt = now() + spacingMs;    // RESTAMP: spacing relative to the retry
        attempt = await attemptOnce(url, init);
        if (attempt.throttled) {
          // A persisted 429 locks the caller out ~30 s — write that into lane state so a
          // queued request doesn't fire into the lockout window. (MCP-PRD §3.4)
          lane.nextAllowedAt = now() + 30_000;
          const text = await attempt.response.text().catch(() => "");
          return rateLimitedFailure(spec.sourceName, spec.detailsFrom(text));
        }
      }
      return attempt.result;
    } finally {
      release();                                  // lane held for the whole request incl. backoff
    }
  }

  // (MCP-PRD D-10) backstop — never a rethrow. Body serialization runs inside it too.
  async function guarded(work: () => Promise<Result<unknown>>): Promise<Result<unknown>> {
    try {
      return await work();
    } catch (err) {
      return fail("unexpected", `Unexpected failure in ${spec.sourceName} client: ${describe(err)}`);
    }
  }

  function get(path: string, query?: Record<string, string | undefined>): Promise<Result<unknown>> {
    return guarded(() => run(path, { headers: baseHeaders() }, query));
  }

  function post(
    path: string,
    body: unknown,
    query?: Record<string, string | undefined>,
  ): Promise<Result<unknown>> {
    return guarded(() =>
      run(
        path,
        {
          method: "POST",
          headers: { ...baseHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        query,
      ),
    );
  }

  return { get, post };
}
