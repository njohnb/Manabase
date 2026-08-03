export type FailureCode =
  | "bad_request"          // HTTP 400 — malformed query; details carries Scryfall's text
  | "not_found"            // HTTP 404
  | "rate_limited"         // HTTP 429 persisted through one backoff-retry
  | "upstream_unavailable" // HTTP 5xx or Scryfall unreachable
  | "network"              // fetch rejected (DNS, timeout, refused)
  | "unexpected";          // anything else; never a rethrow

export interface Failure {
  ok: false;
  error: {
    code: FailureCode;
    message: string;   // one-sentence human/model-readable summary
    details?: string;  // Scryfall's own `details` text, verbatim, when the body carried one
    status?: number;   // HTTP status when applicable
  };
}

export interface Success<T> { ok: true; value: T; }
export type Result<T> = Success<T> | Failure;
