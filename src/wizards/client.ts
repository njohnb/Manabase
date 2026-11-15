import type { Config } from "../config.ts";
import { createHttpClient } from "../http/client.ts";
import type { ClientDeps, HttpClient, SourceSpec } from "../http/client.ts";

/**
 * Wizards of the Coast serves the Comprehensive Rules from TWO hosts (MCP-PRD §4.6): the landing
 * page on `magic.wizards.com` names the dated files, which live on `media.wizards.com`. A
 * `SourceSpec` carries one base URL, so this is one client per host — the pattern `index.ts`
 * already follows for Scryfall and Commander Spellbook — each with its own lane.
 *
 * The media client is only ever handed a PATH, never a scraped absolute URL: the store checks
 * that a resolved file sits on this host before asking for it, so a changed landing page can
 * never steer a request to an arbitrary host.
 */
export interface WizardsClients {
  site: HttpClient;
  media: HttpClient;
}

/** Wizards' error pages are HTML with no machine-readable message. Never throws. */
function detailsFrom(_text: string): string | undefined {
  return undefined;
}

function spec(baseUrl: string, userAgent: string, accept: string): SourceSpec {
  return {
    sourceName: "Wizards of the Coast",
    baseUrl,
    userAgent,
    // (MCP-PRD §3.7) Wizards publishes no limit for these pages, so each host takes §3.4's
    // strictest lane until told otherwise. Volume is tiny regardless: a first use is one request
    // per host, issued in sequence.
    lanes: { default: { spacingMs: 500 } },
    defaultLane: "default",
    detailsFrom,
    accept,
    responseBody: "text",
  };
}

export function createWizardsClients(config: Config, deps?: ClientDeps): WizardsClients {
  return {
    site: createHttpClient(spec(config.wizardsSiteBaseUrl, config.userAgent, "text/html"), deps),
    media: createHttpClient(spec(config.wizardsMediaBaseUrl, config.userAgent, "text/plain"), deps),
  };
}
