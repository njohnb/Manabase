# 02: Rules lookup by rule number — CAP-04 spec and the first `rules_lookup` path

**What to build:** a user asks about rule 702.19, and Claude gets that rule and every subrule
under it. The result includes the Comprehensive Rules (CR) effective date and a citation link to
Wizards' official dated PDF. The first call downloads the CR from Wizards and caches it, and later
calls read the cache. This is the whole first path through the new source, the parser, the cache
and the tool, kept as one demoable ticket. The CAP-04 spec lands in the same change. Details are in
the [PRD](../../2026-11-15-mtg-rules-prd.md), deep modules 2, 3, 4 and 6.

**Blocked by:** None (can start immediately). It can run in parallel with 01.

**Status:** done — merged to `feat/mtg-rules` 2026-11-15. Only the version bump is open; the CI bump job writes it on the PR to `main`.

- [x] A CAP-04 block is appended to [MCP-PRD §5](../../../MCP-PRD.md#5-capabilities) under its
      template, and §6, §7 and §9 are updated.
- [x] [OQ-03](../../../MCP-PRD.md#oq-03--what-is-the-bulk-data-storage-strategy-and-when-is-it-introduced)
      gets a dated §7 answer for its refresh and first-run halves: lazy on first use, a weekly
      check, and yes, first use blocks on one download. It also gets a §9 row. Its "resolves by
      tag discovery" note is corrected by an appended paragraph, not by rewriting it.
- [x] Wizards is a new source on the shared HTTP client, with the app-naming `User-Agent`, an
      `Accept` header and a conservative lane. The two-host question (landing page and media
      download) is handled and the choice recorded.
- [x] The landing-page resolver picks the newest `.txt` **by date stamp, never the first match**,
      per [OQ-08](../../../MCP-PRD.md#oq-08--does-the-cr-landing-page-ever-offer-more-than-one-date-stamped-txt-and-how-are-mid-cycle-corrections-handled).
      It pairs the PDF that has the same stamp, encodes the space in the filename, and falls back
      to citing the TXT when no PDF matches.
- [x] The parser handles everything [§4.6](../../../MCP-PRD.md#46-comprehensive-rules-wizards-of-the-coast)
      records: the BOM, CRLF, the contents section, and subrule letters skipping `l` and `o`.
      Unit tests use **short synthetic fixtures only**. The CR is never committed or bundled, per
      [D-08](../../../MCP-PRD.md#d-08--comprehensive-rules-fetched-at-runtime-never-bundled).
- [x] The first call downloads and caches under the existing resolved cache directory, and a later
      call makes no network request. All I/O is injected, per
      [D-03](../../../MCP-PRD.md#d-03--testability-handlers-callable-as-plain-functions).
- [x] `rule: "702.19"` returns the rule and its subrules, `cr_effective_date`, the cache age and
      the citation URL. An unknown rule number is a structured failure naming the problem.
- [x] If Wizards blocks or the page has changed shape, the result is a structured failure, never
      a workaround, per [§3.7](../../../MCP-PRD.md#37-undocumented-and-bot-protected-third-party-apis).
- [x] The tool is registered, the manifest declares it, `dist/` is rebuilt, the typecheck is clean
      and `npm test` passes.
- [x] A spaced live acceptance check fetches the real CR once and looks up a known rule.
- [ ] The plugin version is bumped in the PR. `doc-sync` is dispatched as the closeout.
