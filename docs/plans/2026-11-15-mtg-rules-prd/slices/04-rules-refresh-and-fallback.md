# 04: Weekly CR refresh and cached-copy fallback

**What to build:** when Wizards publishes a new Comprehensive Rules version, the user gets it
automatically within a week without doing anything. When Wizards' site is down, blocked or
redesigned, rules lookup keeps working from the cached copy and tells the user how old that copy
is.

**Blocked by:** 02. It can run in parallel with 03.

**Status:** ready-for-agent

- [ ] A cached copy checked fewer than 7 days ago is used with no network request.
- [ ] A copy last checked 7 or more days ago revalidates against the landing page. It re-downloads
      only when the date stamp has changed. An unchanged stamp just updates the check time.
- [ ] If revalidation or the download fails, the cached copy is served with `stale: true`, its
      effective date and its age. That is a successful result, not a failure.
- [ ] A first run with no cache that cannot download returns a structured failure explaining that
      the rules could not be fetched.
- [ ] A partly written download never replaces a good cached copy.
- [ ] All of this is tested with a fake clock and fake I/O across the 7-day boundary: unchanged
      stamp, changed stamp, failed check, and failed first run.
- [ ] No refresh happens at startup or from a hook, per
      [PQ-03](../../../PLUGIN-PRD.md#pq-03--what-triggers-a-refresh-of-the-bulk-data-and-the-comprehensive-rules-cache-and-should-it-ever-be-a-sessionstart-hook).
- [ ] `dist/` is rebuilt, the typecheck is clean and `npm test` passes.
- [ ] The plugin version is bumped in the PR. `doc-sync` is dispatched as the closeout.
