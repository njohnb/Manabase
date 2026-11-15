# 03: Rules lookup by keyword — glossary first, then full text

**What to build:** a user asks "how does trample work" or "what is mana value", and `rules_lookup`
with `query` returns the glossary definition first, then the matching rules with their numbers.
Every result carries the same CR date and citation link as a rule-number lookup. A broad word like
"damage" returns a bounded set that fits the response size limit and says that more matches
exist.

**Blocked by:** 02.

**Status:** done — merged to `feat/mtg-rules` 2026-11-15. Only the version bump is open; the CI bump job writes it on the PR to `main`.

- [x] The parser also produces the glossary, covering its term, definition and blank-line pattern,
      including multi-line definitions. It is tested on a synthetic excerpt.
- [x] `query` matches glossary terms first, then rule text, and every rule hit carries its number.
- [x] Results fill to a byte budget in the pattern of the combo tools' shared page budget. The
      response reports when it was truncated, so it is never a silent cut.
- [x] A query with no matches is a successful empty result, not a failure.
- [x] Passing both `rule` and `query`, or neither, is a structured `bad_request`.
- [x] Tests cover glossary-first ordering, the budget on a broad term, and no matches.
- [x] The tool description is updated for the new mode, and the manifest and `dist/` match.
- [x] A spaced live acceptance check runs a keyword query against the real CR.
- [ ] The plugin version is bumped in the PR. `doc-sync` is dispatched as the closeout.
