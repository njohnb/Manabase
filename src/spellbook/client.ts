import type { Config } from "../config.ts";
import { createHttpClient } from "../http/client.ts";
import type { ClientDeps, HttpClient, SourceSpec } from "../http/client.ts";

export type SpellbookClient = HttpClient;

/**
 * Commander Spellbook is Django REST framework, which reports a validation error as a
 * field -> messages map rather than Scryfall's single `details` string:
 * `{"q":["Invalid search query: unexpected character : at position 34."]}` (MCP-PRD §4.4,
 * observed live 2026-08-24). Flatten it to `field: message`, keeping the upstream text
 * verbatim — CAP-02 criterion 3 needs it to survive so the model corrects its own query on the
 * next call (D-10).
 *
 * Never throws. A reader that throws turns a clean `bad_request` into the `unexpected` backstop,
 * which reads as a server fault and discourages the retry that would fix it.
 */
function detailsFrom(text: string): string | undefined {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return undefined; // unparseable body — mapped code survives, details omitted
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;

  const parts: string[] = [];
  for (const [field, value] of Object.entries(body)) {
    const messages: unknown[] = Array.isArray(value) ? value : [value];
    // One unreadable entry drops the whole read: a partial one would report an error body this
    // reader did not actually understand.
    if (messages.length === 0) return undefined;
    if (!messages.every((message) => typeof message === "string")) return undefined;
    parts.push(`${field}: ${messages.join(" ")}`);
  }
  return parts.length > 0 ? parts.join("; ") : undefined;
}

export function createSpellbookClient(config: Config, deps?: ClientDeps): SpellbookClient {
  const spec: SourceSpec = {
    sourceName: "Commander Spellbook",
    baseUrl: config.spellbookBaseUrl,
    userAgent: config.userAgent,
    // (MCP-PRD §3.7) Commander Spellbook publishes no limit and exposes no rate-limit header
    // (§4.4, OQ-05), so it takes §3.4's strictest lane until told otherwise. One host, one lane,
    // and its own state — Scryfall's lanes are sized against Scryfall's published numbers and
    // mean nothing here.
    lanes: { default: { spacingMs: 500 } },
    defaultLane: "default",
    detailsFrom,
  };
  return createHttpClient(spec, deps);
}
