# Track B — Slice 8 results: [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s files, written and measured

**Run date:** 2026-08-04
**Node:** v22.17.1 (unchanged since [Slice 6](./TrackA-Slice6-results.md))
**Claude Code:** 2.1.222
**Deliverables:** [`skills/scryfall-query-craft/SKILL.md`](../../skills/scryfall-query-craft/SKILL.md),
[`reference/operators.md`](../../skills/scryfall-query-craft/reference/operators.md),
[`reference/recipes.md`](../../skills/scryfall-query-craft/reference/recipes.md); both `.gitkeep`
placeholders deleted.
**Result:** [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criteria **1, 3, 4 met** with the
evidence below. **Criterion 2 is [Slice 10](./TrackC-Slice10.md)'s** (`claude plugin details`
against the installed plugin) and **criteria 5–13 are [Slice 9](./TrackB-Slice9.md)'s** (fresh-session
behavioral evals against a without-skill baseline) — neither is claimed here, per the
[spec](./TrackB-Slice8.md)'s scope.
**Scryfall traffic:** 23 live calls total across two serial batches (16 + 7), one query at a time,
≥700 ms apart, no loops, no 429 observed ([MCP-PRD §3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)
honored).

## Measurement 1 — the listing budget ([PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion 1)

**Instrument:** the [spec](./TrackB-Slice8.md)'s verification step 1 script (Node, frontmatter
values only — not keys, quotes, or indentation).

| Field | Characters |
|---|---|
| `description` value | 269 |
| `when_to_use` value | 494 |
| **Combined (space-joined)** | **764** |

Bare concatenation measures 763; the space-joined 764 is the larger and is the recorded number.
**764 ≤ 1,536** — criterion 1 **met**, and it also clears the ≤1,000 planning figure the spec sets
for [Slice 10](./TrackC-Slice10.md)'s ≤250-token always-on criterion (criterion 2), recorded here
so that slice can correlate.

## Measurement 2 — the body size ([PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion 3)

Two instruments, per the spec's preference order:

| Instrument | Number |
|---|---|
| **(a)** Anthropic `count_tokens` API, model id `claude-fable-5` | **2,169 tokens** |
| **(c)** character fallback — 5,429 body characters ÷ 3.5 | 1,552 tokens |

The instruments disagree; the larger number governs: **2,169 tokens ≤ 5,000** — criterion 3
**met**. The body is safe through compaction re-attachment
([PLUGIN-PRD §3.1](../PLUGIN-PRD.md#31-context-budget)).

**The ≤2,000 target is exceeded by 169 tokens, and here is the settling record the spec
requires.** The first draft measured 2,387 real tokens; two trim passes (compressing prose in the
procedure, `unique`/`order`/`dir`, pagination, failure-loop, and result-reading sections, and
cutting a field enumeration duplicated by the tool result itself) brought it to 2,169. What
remains is exactly the seven content items the spec's requirements 6 and 9–14 mandate — the
procedure, the high-frequency operator table, the failure loop with the silent-drop trap, the
`illustrationtag:` warning, the meaning-changing parameters, narrow-don't-page, and the reference
read triggers — plus the two worked examples requirement 8 keeps in the body. Operator-dense
markdown tokenizes at ~2.5 characters per token here, and every candidate for further cutting is a
line that shapes the first query for some common request, which is the split rule's test for what
must stay. Everything that failed that test already lives in
[`reference/`](../../skills/scryfall-query-craft/reference/operators.md).

## Operator verification log — 2026-08-04, live through `dist/index.js`

Everything the skill names as real is either in [MCP-PRD §4.1.1](../MCP-PRD.md#411-search-endpoint)'s
verified table, in [Slice 6](./TrackA-Slice6-results.md)'s live log, or below. All calls went
through the built server over stdio (bare `card_search` — the scoped name is the harness's doing
and does not apply there). Counts are **dated observations, not targets**, and none appears in any
skill file.

### Batch 1 — candidate operators (16 calls)

| # | Operator | Query sent | Outcome | Verdict |
|---|---|---|---|---|
| 1 | `c:` | `c:g t:creature cmc=0` | 200, total_cards 5 | verified real |
| 2 | `id:` | `id:golgari t:land cmc=0` | 200, total_cards 525 | verified real |
| 3 | `r:` | `r:mythic t:land` | 200, total_cards 148 | verified real |
| 4 | `pow` + comparison | `pow>=15 t:creature` | 200, total_cards 6 | verified real |
| 5 | `tou` + comparison | `tou<=0 t:creature` | 200, total_cards 430 | verified real; `*` toughness compares as 0 |
| 6 | `kw:` | `kw:deathtouch t:artifact` | 200, total_cards 17 | verified real |
| 7 | `mv` (alias of `cmc`) | `mv=0 t:creature c:g` | 200, total_cards 5 — identical to #1 | verified real |
| 7b | `mv` + comparison | `mv>=15 t:creature` | 200, total_cards 8 | verified real |
| 8 | `or` + parentheses | `t:squirrel (c:g or c:b) cmc<=2` | 200, total_cards 18 | verified real |
| 9 | `!=` | `r!=common t:squirrel cmc<=1` | 200, total_cards 3 | verified real |
| 10 | `not:` | `not:reprint t:squirrel cmc=1` | 200, total_cards 4 | verified real |
| 11 | `banned:` | `banned:commander t:creature cmc=0` | 200, total_cards 0 (zero-match note) | verified real — it filtered, so it parsed (see below) |
| 12 | `restricted:` | `restricted:vintage t:artifact cmc=0` | 200, total_cards 10 | verified real |
| 13 | invalid-term probe | `t:creature xyzzyfaketerm:foo` | 200, total_cards 18695 | invalid term silently dropped |
| 14 | plausible-invalid probe | `t:creature illustrationtag:squirrel` | 200, total_cards 18695 | invalid term silently dropped |
| — | control (baseline) | `t:creature` | 200, total_cards 18695 | baseline for #13/#14 |
| — | control (pure invalid) | `xyzzyfaketerm:foo` | **400** `bad_request`, details `All of your terms were ignored.` | confirms the 400 fires only when every term is invalid |

### Batch 2 — argument forms, by baseline comparison (7 calls)

Because of the silent-drop behavior (next section), a bare 200 does not prove an argument form
parsed — only a count that *differs from the same query without the term under test* does. Each
probe below is paired with its baseline:

| Baseline | Count | Probe | Count | Verdict |
|---|---|---|---|---|
| `t:squirrel cmc<=1` | 5 | `r>=rare t:squirrel cmc<=1` | 1 | `r` with range comparisons: verified |
| `t:land cmc=0` | 1142 | `c:simic t:land cmc=0` | 0 | guild-name argument to `c:`: verified (filtered, therefore parsed) |
| `t:land cmc=0` | 1142 | `c:wu t:land cmc=0` | 0 | combined-letter argument to `c:`: verified (same reasoning) |
| `t:squirrel` | 43 | `t:squirrel or t:beast` | 587 | bare `or` between terms: verified (widened, therefore parsed) |

Argument words used purely as syntax illustrations in the skill files (`is:reprint`,
`is:commander`, `is:permanent`, `kw:flying`, `f:standard`, `set:dom`, guild names other than the
ones probed) are illustrations of verified *operators*, not independently verified argument
values; the skill's own rule — never trust a suspiciously broad result — is the guard the files
teach for exactly this class.

## The partial-invalidity finding

The [spec](./TrackB-Slice8.md)'s requirement 11 asked for this to be verified live before being
written as instruction, and the result is sharper than the spec's caution suggested: **Scryfall
silently drops an unrecognized term whenever at least one recognized term remains.** Probes 13
and 14 returned HTTP 200 with `total_cards` byte-identical to the bare `t:creature` baseline —
no error, no note, no diagnostic of any kind surfaced through the tool result. The
"All of your terms were ignored." 400 fires only when *every* term is invalid (the pure-invalid
control). Consequences, all now taught in the skill files:

- a hallucinated operator inside an otherwise-valid query produces a confident, ordinary-looking,
  **wrong** result computed from fewer constraints than the user asked for;
- a 400 is a sound non-existence proof only for a *single-term* query — which is how every probe
  above was constructed (single new term against a known baseline);
- the only safe rule for the model is *never emit an operator you have not seen work*, and the
  skill states it in [`SKILL.md`](../../skills/scryfall-query-craft/SKILL.md), in
  [`operators.md`](../../skills/scryfall-query-craft/reference/operators.md)'s "Not real — never
  emit" close, and in [`recipes.md`](../../skills/scryfall-query-craft/reference/recipes.md)'s
  failure table — deliberate redundancy, since the reference files are read independently of the
  body.

## Changes made during verification

One line was removed from [`operators.md`](../../skills/scryfall-query-craft/reference/operators.md)
before review: a claim that cards with no USD price never match a `usd` comparison. Plausible,
untested, and exactly the class of assertion the verification log exists to gate — deleted rather
than verified, since the skill does not need it.

## Card-fact review record ([PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion 4)

**Reviewer:** a fresh subagent (Claude Opus) with **no authoring context** — its prompt contained
only the three file paths and requirement 20's seven-point checklist, verbatim, plus the scope
note that operator syntax is instruction while any specific card's status is a fact. Run
2026-08-04, after the trim passes and the `usd` line removal above, over the exact files as
committed.

**Verdict: PASS — no card facts.** Zero flags across all three files, so **zero lines were
changed in response** to the review. The reviewer explicitly examined and cleared the closest
calls: the `<CARDNAME>` placeholders (the substitution test is pre-passed by construction — no
real card name appears anywhere in the three files); the `f:` / `banned:` / `restricted:` / `usd`
rows (argument forms, no card's status asserted); the worked examples (concrete nouns are types,
subtypes, and community tag names, never card names); the `*`-toughness note (comparison
semantics of the `tou` operator, not any card's printed value); the regex examples (search
patterns demonstrating anchors and alternation, asserting nothing about which cards match); and
the page size 175 (an API constant, not a match count). It confirmed no match count, no price
value, no rules text, and no evaluative or metagame claim appears in any file.

## Prefilter record (verification step 4)

The mechanical prefilter (`grep -rniE '\$[0-9]|[0-9]{1,3},[0-9]{3}|\b(banned|restricted|legal in|combos? with|staple|best)\b' skills/`)
returned four hits, each justified here line by line:

| File and line | Hit | Why it is not a card fact |
|---|---|---|
| [`operators.md`](../../skills/scryfall-query-craft/reference/operators.md) — `banned:` catalog row | `banned` | teaches the operator's argument form (`banned:commander`); asserts no card's ban status |
| [`operators.md`](../../skills/scryfall-query-craft/reference/operators.md) — `restricted:` catalog row | `restricted` | same — operator syntax, no card named |
| [`SKILL.md`](../../skills/scryfall-query-craft/SKILL.md) frontmatter `description` | `legal in` | inside the quoted example *request* ("cheap green ramp legal in my commander deck") — the user's words the skill matches against, claiming nothing |
| [`SKILL.md`](../../skills/scryfall-query-craft/SKILL.md) operator table, format row | `banned:modern`; `restricted:vintage` | operator + argument-form illustrations; no card is said to be banned or restricted |

The scoped-name check (verification step 3) returned **no output**: every tool mention in every
skill file is `mcp__plugin_manabase_mtg__card_search`
([P-12](../PLUGIN-PRD.md#p-12--plugin-name-and-server-key)).

## Where the required content lives (acceptance criterion 4)

All in [`SKILL.md`](../../skills/scryfall-query-craft/SKILL.md), by section:

| Required item (spec req.) | Section |
|---|---|
| English-request-to-query procedure (9) | "Procedure" |
| high-frequency operators only (10) | "The operators most requests need" |
| failure loop, bounded, with both non-obvious cases (11) | "When it goes wrong" |
| non-existent operators (12) | "When it goes wrong", final bullet; reinforced in both reference files |
| `unique` / `order` / `dir` (13) | "unique, order, dir" |
| narrow-don't-page (14) | "Narrow, don't page" |
| explicit read trigger per reference file (6) | end of "The operators most requests need" (both files, `${CLAUDE_SKILL_DIR}` form) |

## Standing gates

Run 2026-08-04, proving the tree is otherwise untouched:

- `npm run typecheck` — **passes**.
- The test suite — **67 tests, 19 suites, 0 failures**, run as
  `node --experimental-strip-types --test "tests/**/*.test.ts"`. The `npm test` *script* itself
  fails on this machine with `ERR_UNKNOWN_FILE_EXTENSION` — a pre-existing condition of `main`
  (Node 22.17 needs the strip-types flag, and the unquoted glob under-matches) whose fix already
  exists on the unmerged `fix/npm-test-node22` branch. Nothing in this slice touches it either
  way; the corrected invocation is that branch's, and the full-suite pass is the evidence this
  criterion wants. *(Dated addendum, later the same day: that fix branch has since merged, and
  `npm test` itself now reports 67/67 on `main`.)*
- `claude plugin validate .` — **passes** with the single known warning (`plugin.json` has no
  `version`); `--strict` fails on exactly that warning. This is the
  [Slice 7](./TrackB-Slice7-results.md) criterion 9 disposition, unchanged: the warning *is*
  [P-08](../PLUGIN-PRD.md#p-08--version-scheme)'s deliberately unset version, open until
  [Slice 13](./TrackC-Slice13.md).
- `git diff --stat` — changes confined to `skills/` and `docs/slices/` plus the
  [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md) status row; `src/`, `dist/`, `tests/` untouched and
  `dist/index.js` byte-identical; both `.gitkeep` placeholders deleted.
