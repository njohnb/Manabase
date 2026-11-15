import type { Result } from "../result.ts";

/** Where the current Comprehensive Rules live, as read off Wizards' landing page. */
export interface CrSource {
  /** `YYYYMMDD`, from the filename. */
  dateStamp: string;
  /** Absolute and percent-encoded — the live filename carries a literal space (MCP-PRD §4.6). */
  txtUrl: string;
  /** The PDF carrying the SAME stamp, when the page lists one. Absent otherwise. */
  pdfUrl?: string;
  /** What a citation links to: the dated PDF, else the TXT. Never a third-party mirror. */
  citationUrl: string;
}

const HREF = /href\s*=\s*(["'])([^"']*?MagicCompRules[^"']*?(\d{8})\.(txt|pdf))\1/gi;

/**
 * Landing-page HTML in, the newest dated TXT (and its same-stamp PDF) out. Pure.
 *
 * Takes the newest `.txt` BY ITS DATE STAMP, never the first match in document order: whether
 * the page ever lists two at once is still open (MCP-PRD OQ-08), and assuming it never does would
 * serve the older document the first time it does. `new URL` both resolves a relative href and
 * percent-encodes the literal space in the filename.
 */
export function resolveCrSource(html: string, pageUrl: string): Result<CrSource> {
  const txt = new Map<string, string>();
  const pdf = new Map<string, string>();

  for (const match of html.matchAll(HREF)) {
    const href = match[2]!;
    const stamp = match[3]!;
    const kind = match[4]!.toLowerCase();
    let absolute: string;
    try {
      absolute = new URL(href, pageUrl).href;
    } catch {
      continue; // an unparseable href is skipped, not guessed at
    }
    (kind === "txt" ? txt : pdf).set(stamp, absolute);
  }

  // `YYYYMMDD` sorts lexically in date order.
  const newest = [...txt.keys()].sort().at(-1);
  if (newest === undefined) {
    return {
      ok: false,
      error: {
        code: "unexpected",
        message:
          "The Wizards rules page listed no dated Comprehensive Rules .txt — the page may have " +
          "changed shape or served a challenge instead of the page. This is reported, not worked " +
          "around (MCP-PRD §3.7).",
      },
    };
  }

  const txtUrl = txt.get(newest)!;
  const pdfUrl = pdf.get(newest);
  // (exactOptionalPropertyTypes) `pdfUrl` is absent, never `undefined`.
  return {
    ok: true,
    value: {
      dateStamp: newest,
      txtUrl,
      ...(pdfUrl !== undefined ? { pdfUrl } : {}),
      citationUrl: pdfUrl ?? txtUrl,
    },
  };
}
