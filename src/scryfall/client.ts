import type { Config } from "../config.ts";
import { createHttpClient } from "../http/client.ts";
import type { ClientDeps, HttpClient, SourceSpec } from "../http/client.ts";

// Re-exported from its new home so no importer learns a new path.
export type { ClientDeps };

/** Gains `post` with the transport — `POST /cards/collection` is Slice 17's batch resolution. */
export type ScryfallClient = HttpClient;

// (MCP-PRD §3.4) card-search-family endpoints are limited to 2/sec; everything else to 10/sec.
const CARD_PATH_PREFIXES = ["/cards/search", "/cards/named", "/cards/random", "/cards/collection"];

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

export function createScryfallClient(config: Config, deps?: ClientDeps): ScryfallClient {
  const spec: SourceSpec = {
    sourceName: "Scryfall",
    baseUrl: config.scryfallBaseUrl,
    userAgent: config.userAgent,
    lanes: {
      card: { spacingMs: 500, pathPrefixes: CARD_PATH_PREFIXES },
      other: { spacingMs: 100 },
    },
    defaultLane: "other",
    detailsFrom,
  };
  return createHttpClient(spec, deps);
}
