# Track B — Slice 8: PC-01 SKILL.md authoring

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

**Goal.** Write the skill that turns "cheap green ramp that's legal in my commander deck" into a
real Scryfall query. The server has been able to answer that question since Track A closed;
nothing yet teaches Claude to ask it. This slice delivers `skills/scryfall-query-craft/SKILL.md`
plus the on-demand files under `reference/`, and closes the PC-01 criteria that are checkable
against the files themselves: the 1,536-character listing budget (criterion 1), the 5,000-token
body ceiling (criterion 3), and the no-card-facts review (criterion 4). Everything behavioral —
does the skill fire, does it produce the right operators — is Slice 9's, measured in fresh
sessions. This slice writes the hypothesis; it does not get to claim the result.

## Preconditions

The dependency graph (`docs/DEV-ROADMAP.md` §5) puts one edge into this slice: Slice 3, which
fixed the tool's shape. Track A is closed, so you get considerably more than the minimum, and
every fact in **Interface contracts** below is read off shipped, live-verified code rather than
inferred:

- `src/tools/card-search.ts` — `CardSearchParams`, `CardSummary`, `CardSearchData`, and
  `PriceInfo` are final (Slices 3–4). These are the field names a model actually sees.
- `src/tools/register.ts` — the bare tool name `card_search`, its compact description, and its
  JSON Schema (Slice 5). The description is already in the model's context every session; the
  skill's job is to extend it, not restate it.
- `docs/slices/TrackA-Slice6-results.md` — live evidence, 13/13 checks, for the operators, the
  invalid-operator 400, the zero-match 404 → empty-success mapping, and each price finish.
- `skills/scryfall-query-craft/` and `skills/scryfall-query-craft/reference/` exist and contain
  **only** `.gitkeep`. Confirm this before starting; if either holds real content, someone else
  started this slice.
- `.claude-plugin/plugin.json` names the plugin `manabase`; `.mcp.json` names the server key
  `mtg`. Those two strings produce the scoped tool name below and must not be changed here.

**Not preconditions.** An installed plugin (Slice 7), an eval harness (Slice 9), and a
`claude plugin details` measurement (Slice 10) are all absent and all fine to be absent. Slice 8
is the parallelism opportunity in the graph precisely because it needs none of them.

## Context

Manabase is a Magic: The Gathering MCP server (Scryfall-backed card search) that ships inside a
Claude Code plugin. This is slice 8 of 13, the middle slice of Track B: install verification
(7) → **skill authoring** (8) → evals (9). It can run in parallel with Slices 7 and 11.

PC-01 is the plugin-side complement to the server's CAP-01: CAP-01 makes the search possible,
PC-01 makes it good. Without it, the tools require the user to know the thing the plugin exists
to know for them — which is the state the product is in right now.

## Deliverables

| File | Action |
|---|---|
| `skills/scryfall-query-craft/SKILL.md` | new — frontmatter (always-on cost) + body (on-invoke cost) |
| `skills/scryfall-query-craft/reference/operators.md` | new — exhaustive operator catalog, read on demand |
| `skills/scryfall-query-craft/reference/recipes.md` | new — worked English→query translations and the failure loop |
| `skills/scryfall-query-craft/.gitkeep` | delete — the directory now holds real files |
| `skills/scryfall-query-craft/reference/.gitkeep` | delete — same |
| `docs/slices/TrackB-Slice8-results.md` | new — the measurements, the operator-verification log, the card-fact review record |
| `docs/DEV-ROADMAP.md` | modify — Slice 8 row to ☑, its three done-when boxes, and a Landed note. Nothing else |

**`src/` and `dist/` are untouched.** This slice changes no server code, so there is no rebuild
and no `dist/index.js` in the diff. If `git diff --stat` shows either, something is wrong.

**No PRD edit.** This slice resolves no open question. PC-01's §7/§9 record and MCP-PRD's OQ-01
update both belong to Slice 9, when the numbers exist. Recording static measurements in the
results doc is not a substitute for that and does not pre-empt it.

## Requirements

1. **Frontmatter: three keys, and none you cannot validate.** `name: scryfall-query-craft`
   (matching the directory — the harness prefixes it, which is what makes PC-01's stated
   `/manabase:scryfall-query-craft` surface work), `description`, and `when_to_use`. Do **not**
   set `disable-model-invocation`: PC-01 exists to fire unprompted, and that is the entire
   justification for paying its always-on cost. Do **not** add `allowed-tools` in Phase 1 — it
   is a restriction, not a grant, and an unverified restriction can silently prevent the very
   tool call the skill exists to produce; if a later session adds one, the entry must be the
   scoped form from **Interface contracts** (PLUGIN-PRD P-12). Write any boolean as
   `true`/`false`; the `yes`/`no`/`on`/`off` aliases need harness 2.1.218, above the plugin's
   2.1.207 floor (PLUGIN-PRD §3.2). Invent no other keys — `claude plugin validate . --strict`
   is the check, and it is a standing gate anyway (`docs/DEV-ROADMAP.md` §3, rule 7).

2. **The `description` + `when_to_use` wording must match plain Magic questions that never say
   "Scryfall."** This text is the listing the model sees every turn; it is what decides whether
   the skill fires at all. Write it against how the request actually arrives — "cheap green ramp
   that's legal in my commander deck", "creatures that make a token when they die", "cards with
   squirrel art", "budget removal under a dollar" — none of which contain the words *Scryfall*,
   *query*, or *syntax*. Put the key use case first (PLUGIN-PRD §3.1: the listing truncates at
   the cap, so trailing text is the text that disappears). Use the user's vocabulary — commander,
   EDH, deck, mana value, format, legality, artwork, budget — not the plugin's.
   **This wording is a hypothesis, not a result.** Slice 9 measures should-trigger against
   should-not-trigger rate (PC-01 criteria 5 and 11) and tunes it. Write it as one rewritable
   block of prose rather than something structurally load-bearing, so tuning it is cheap.

3. **Gate: `description` + `when_to_use` ≤1,536 characters** (PC-01 criterion 1; PLUGIN-PRD
   §3.1's `skillListingMaxDescChars`). **Characters, not tokens.** Measure with verification
   step 1 and record the number in the results doc. Count the concatenated *values* — not the
   YAML keys, quotes, or indentation — since the concatenation is what the harness shows; if the
   two counts differ materially, record the larger and say which rule you used.
   **A planning figure, not a gate:** PC-01 criterion 2 caps always-on cost at ≤250 tokens, and
   that is measured in **Slice 10** by `claude plugin details manabase`, not here. At roughly
   four characters per token, 250 tokens is about 1,000 characters — so frontmatter written up
   against the 1,536 cap will probably fail a criterion this slice cannot check. Aim for ≤1,000
   combined characters and record the count so Slice 10 can correlate. 1,536 is a cap on what
   the harness will display, never a target.

4. **Gate: `SKILL.md` body ≤5,000 tokens. Target ≤2,000.** The ceiling is PC-01 criterion 3 and
   PLUGIN-PRD §3.1: after compaction the harness re-attaches only the **first 5,000 tokens** of
   each skill's most recent invocation, inside a 25,000-token combined budget across all skills.
   **A body past the ceiling silently loses its tail.** There is no error and no warning — the
   model simply stops having the end of your instructions partway through a long session, which
   is exactly the session where it needed them. That invisible failure mode is the whole reason
   bulk belongs in `reference/`, and it is why the ceiling is a gate rather than advice. The
   ≤2,000 figure is PC-01's on-invoke target and the number to design against; treat any body
   over it as a signal that something belongs in a reference file, not as a budget to spend down
   to 5,000.

5. **How to count tokens — pick an instrument and record which one.** In order of preference:
   (a) a real tokenizer for the active model, e.g. the Anthropic `count_tokens` API — the same
   instrument `claude plugin details` uses (PLUGIN-PRD §4.6) — recording the model id alongside
   the number; (b) any locally installed tokenizer, named in the record; (c) the character-based
   fallback in verification step 2. If you use the fallback, divide characters by **3.5**, not 4:
   markdown dense with backticks, operators, and punctuation tokenizes worse than prose, and the
   pessimistic divisor is the point. That puts the ≤2,000 target at ~7,000 characters and the
   5,000 ceiling at ~17,500. **Do not relax the divisor to make a number fit** — move content to
   `reference/` instead. If two instruments disagree, gate on the larger number.

6. **The split rule, stated once and applied everywhere.** A line belongs in `SKILL.md` only if
   it is needed to write a *good first query* for a typical request. Everything else goes in
   `reference/`. The falsifiable form: if deleting the line would not change the first query the
   model writes for a common request, it is reference material. Progressive disclosure is a
   harness-verified mechanism (PLUGIN-PRD §4.1) and it only works if the body names each
   reference file **with an explicit read trigger** — "when the request needs an operator not
   listed above, read `${CLAUDE_SKILL_DIR}/reference/operators.md`". A reference file the body
   never names is a file that is never read, and its tokens were spent for nothing.
   Use the `${CLAUDE_SKILL_DIR}` substitution rather than a bare relative path: the substitution
   is verified (PLUGIN-PRD §4.1), resolution of a relative path from an arbitrary cwd is not.
   Reference files must live **inside** the skill directory — an installed plugin cannot
   reference `../` paths at all (PLUGIN-PRD §3.3).

7. **`reference/operators.md` — the exhaustive catalog.** Grouped by family, each entry one line:
   the operator, its argument form, and what it selects. Cover at minimum: card type, colors and
   color identity, mana cost and mana value, oracle text (plain and the regex form `o:/…/`),
   the oracle-tag operators `otag:` / `function:`, the art-tag operators `art:` / `atag:`, set
   and rarity, format legality, price, the `is:` / `not:` shortcut family, exact-name matching,
   comparison operators (`=`, `!=`, `<`, `<=`, `>`, `>=`), negation, boolean `or`, and grouping.
   Close with a short **"not real — never emit"** section (requirement 12). No prose paragraphs;
   this file is looked up, not read.

8. **`reference/recipes.md` — worked translations and the failure loop.** English request → the
   query it becomes, one line each, covering the request shapes PC-01 criteria 6–9 probe:
   legality + type + cost + price ceiling combined in one query; a text *pattern* that only regex
   answers; a request about what a card *does* functionally rather than what it says; a request
   about artwork. Then a failure table: the shape of Scryfall's `details` text on the left, the
   revision it implies on the right. Keep two or three of the strongest examples in the body as
   well — the body's copies are what shape the first attempt; this file is the long tail.

9. **Body: the English-request-to-query procedure.** Not a list of operators — a procedure the
   model follows. Roughly: extract the constraints the request actually contains (colors, type,
   cost, format, price, behavior, artwork); map each to one operator; combine them in a single
   query, since terms are implicitly ANDed and one precise call beats three vague ones; choose
   `unique` / `order` deliberately (requirement 13); call the tool once; read `total_cards`
   before reading the cards; narrow or refine. Make explicit that the *whole* request goes into
   one query rather than being split into a query plus client-side filtering — PC-01 criterion 6
   measures exactly that.

10. **Body: the high-frequency operators only.** The ones that appear in most queries live in the
    body; the rest live in `reference/operators.md`. **Every operator you name as real must be
    traceable.** The verified set is MCP-PRD §4.1.1's table plus the queries exercised live in
    `docs/slices/TrackA-Slice6-results.md`: `t:`, `o:`, the regex form `o:/…/`, `f:`, `cmc` with
    comparisons, `usd` with comparisons, `otag:`, `function:`, `art:`, `atag:`, `set:`, `is:`,
    `game:`, `name:`, exact-name `!"…"`, leading `-` negation, and the query-embedded
    `unique:prints` form. Anything else — color and color-identity operators, rarity,
    power/toughness, keyword, `mv` as an alias for `cmc`, `or`, parentheses — is *plausible and
    probably right*, which is exactly the state that produces an invented operator. **Verify it
    live before writing it down** (verification step 5), and log what you verified and when in
    the results doc. Do not copy an operator list out of memory.

11. **Body: the failure loop.** The server returns Scryfall's own `details` text verbatim on a
    malformed query (MCP-PRD D-10, CAP-01). The skill directs Claude to **read it, revise the
    query, and call again** — never to report a dead end to the user on the first failure. Give
    the loop a bound (revise and retry, then report what was tried and why, rather than looping
    indefinitely) and name the two non-obvious cases:
    - **Zero matches is not a failure.** Scryfall answers a valid query with no matches as HTTP
      404, and the handler maps that to a *successful* empty result — `cards: []`,
      `total_cards: 0`, and a `note`. So an empty result means "loosen the query", never "the
      tool broke". Getting this wrong produces an apology where a second query belongs.
    - **A wrong operator does not reliably announce itself.** Scryfall returns HTTP 400 with
      "All of your terms were ignored." only when *every* term is invalid. It attaches a
      `warnings` array naming an ignored expression, and `src/scryfall/client.ts` reads only
      `details` — `warnings` is declared in the error-body type and never surfaced. So a query
      whose other terms are valid may return a perfectly ordinary-looking 200 computed from
      fewer constraints than were asked for. Verify the partial-invalidity behavior live before
      writing it as instruction; the safe rule either way is *never emit an operator you have
      not seen work*.

12. **Body: the operators that plausibly do not exist.** `illustrationtag:` is the named case —
    it looks exactly like `otag:`/`atag:` and returns HTTP 400, "All of your terms were ignored."
    (MCP-PRD §4.1.1, verified twice). PC-01 criterion 10 is a negative check that it never
    appears in an emitted query across the whole eval set, so the body must name it explicitly
    and say what to use instead (`art:` / `atag:` for artwork, `otag:` / `function:` for
    behavior). State the general rule alongside the specific one: an operator that *feels* like
    it should exist is the most likely thing to be wrong, and a guess costs a real request
    against a 2/second budget.

13. **Body: the parameters that change meaning, not formatting.** `unique`, `order`, and `dir`
    (CAP-01). `unique=cards` is the default and is a deckbuilding default — one row per card, not
    per printing; `unique=prints` is what a question about a *specific printing* needs and is
    almost never what a deckbuilding question needs. `order` decides which 175 cards you see
    first, which on an over-broad query decides the whole answer. Say what each does; do not
    enumerate every `order` value in the body — that is `reference/operators.md`'s job.

14. **Body: narrow, don't page.** The tool reports pagination and never resolves it: 175 cards
    per page, `total_cards` and `has_more` in every response, and a `note` when more pages exist.
    It **never** auto-fetches. A large `total_cards` is a signal that the query is too loose, not
    a download job — the right move is another constraint, not `page: 2`. Paging is legitimate
    only when the user asked for something genuinely large and the query is already as tight as
    the request allows.

15. **Every tool reference uses the scoped form** `mcp__plugin_manabase_mtg__card_search`
    (PLUGIN-PRD P-12). The server registers the bare `card_search`; the harness scopes it, and
    the scoped form is what permission rules, `allowed-tools` entries, and hook matchers must
    use — a rule written against the bare name never fires. A skill that teaches the bare name
    teaches something the user cannot act on. Verification step 3 is the check.

16. **Skills carry instructions, never card facts** (PLUGIN-PRD §3.6 — the sharpest rule in this
    slice, and the easiest to break while trying to be helpful). A card fact inside a skill is a
    hallucination source that goes stale silently and cannot be corrected by a tool call, because
    the model has no reason to doubt it. The line runs between *how to ask* and *what the answer
    is*:

    | Instruction — belongs in the skill | Card fact — forbidden anywhere in `SKILL.md` or `reference/` |
    |---|---|
    | "`t:creature f:commander cmc<=2` — type, legality, and cost combine in one query" | "`f:commander` excludes the cards on the Commander ban list" |
    | "`!"Sol Ring"` matches an exact name; the `!` prefix is what makes it exact" | "Sol Ring is legal in Commander and costs about a dollar" |
    | "`otag:ramp` searches community oracle tags rather than card text" | "`otag:ramp` returns about 2,274 cards" |
    | "`o:/^{T}: Add/` finds text matching a pattern rather than a keyword" | "Mana rocks read '{T}: Add one mana of any color'" |
    | "When the request is about what a card *does*, reach for `otag:`/`function:`" | "Thassa's Oracle and Demonic Consultation win the game together" |

    Three specific traps:
    - **Operator counts are the most tempting and the most wrong.** MCP-PRD §4.1.1 records real
      measured counts and they are *dated observations, not targets* — between 2026-07-29 and
      2026-08-03 alone, regex went 1,554→1,555, `otag:ramp` 2,260→2,274, `function:removal`
      6,386→6,405, `art:squirrel` 192→194. Baking any of them into a skill ships a number that is
      wrong within days and that the model will state confidently. Never write a count.
    - **Card names are allowed only as syntax illustrations.** The test: replace the card name
      with `<CARDNAME>`. If the sentence still teaches the same syntax point, the name was an
      illustration; if the sentence loses its meaning, the name was carrying a fact.
    - **Evaluative claims are facts in disguise.** "X is a staple", "Y is the best Z", "every
      commander deck runs W" are assertions about a metagame that drifts, phrased as advice.

17. **This slice makes OQ-01's bet explicit — and must not assume its answer.** MCP-PRD OQ-01
    asks how Scryfall syntax should reach the model. The delivered `card_search` took the
    compact-description side: five lines naming the operator families and the pagination
    contract, with the deep teaching left to this skill. **Nothing has measured whether that
    split works.** Slice 9 measures it. Two consequences here: do not restate the tool
    description's content in the skill body (it is already in context every session — the body
    extends it, and duplication is paid twice), and do not write the skill so that it only works
    if the split is wrong — no "the tool description is insufficient, here is everything again".
    If the split does fail, what changes is the description in `src/tools/register.ts`, which is
    Slice 9's finding to act on, not this slice's to pre-empt.

18. **Change nothing under `src/`, and do not rebuild `dist/`.** The skill teaches the tool as it
    exists. If authoring reveals that the tool's shape is wrong, that is a finding to record in
    the results doc and raise against MCP-PRD — not a change to make here (PLUGIN-PRD §1's
    boundary rule: a tool spec never appears on the plugin side).

19. **Record the evidence** in `docs/slices/TrackB-Slice8-results.md`: date, Node and Claude Code
    versions, the two measured numbers with the instrument named for each, the operator
    verification log (operator, query issued, date, outcome) for everything named beyond
    MCP-PRD §4.1.1's verified table, the card-fact review record (requirement 20), and an
    explicit statement that criterion 2 is Slice 10's and criteria 5–13 are Slice 9's, neither
    claimed here.

20. **The card-fact review has a reviewer and a checklist** — otherwise PC-01 criterion 4 is
    unfalsifiable. Perform it with a **fresh reviewer that has no authoring context**: a subagent,
    or a second session, given only the files and the checklist below. The author cannot do it
    from the authoring session — the intent behind a sentence papers over what the sentence
    actually claims, which is the same reason PC-01 requires fresh sessions for its behavioral
    criteria. The reviewer reads `SKILL.md` and every file under `reference/` line by line and
    flags:
    1. any sentence whose truth depends on Scryfall's data at a point in time;
    2. any number claiming how many cards match anything;
    3. any card's rules text, quoted or paraphrased;
    4. any price or price range;
    5. any legality, ban, or restriction claim, for any card in any format;
    6. any claim that cards combo, or that a card is good, best, or a staple;
    7. any card name that fails the `<CARDNAME>` substitution test in requirement 16.

    Verification step 4 is a mechanical prefilter, not the review. Record the reviewer (fresh
    session or subagent), the verdict, and every line changed as a result.

## Interface contracts

The skill teaches this and must be accurate about it. Read the source before writing —
`src/tools/register.ts` and `src/tools/card-search.ts` are canonical, this section is a copy.

**Name.** The server registers the bare `card_search`. Inside the plugin the harness exposes it
as **`mcp__plugin_manabase_mtg__card_search`** — `mcp__plugin_<plugin-name>_<server-name>__<tool>`,
from plugin name `manabase` (`.claude-plugin/plugin.json`) and server key `mtg` (`.mcp.json`).
The scoped form is the only form the skill uses (P-12).

**Parameters** (`q` required, everything else optional):

| Parameter | Type | Meaning |
|---|---|---|
| `q` | string, **required** | The Scryfall query. Sent verbatim — never parsed, validated, or rewritten by the server (MCP-PRD D-07). Scryfall evaluates the syntax, which is why the full language works and why a bad query comes back as Scryfall's own error text |
| `unique` | `cards` \| `prints` \| `art` | Result rollup. Defaults to `cards` — one row per card, not per printing |
| `order` | string | Sort field, e.g. `name`, `cmc`, `usd`, `edhrec`, `released` |
| `dir` | `auto` \| `asc` \| `desc` | Sort direction |
| `page` | integer ≥ 1 | 1-based; 175 cards per page. Defaults to 1 |

**Success result.** `content[0].text` is JSON — a `CardSearchData`:

```jsonc
{
  "cards": [ /* CardSummary */ ],
  "total_cards": 1197,     // the true total, not the number returned
  "page": 1,
  "has_more": true,
  "note": "…"              // present when there are more pages, or when nothing matched
}
```

Each `CardSummary` carries exactly these keys — optional ones are **absent**, never null:
`name`, `mana_cost?`, `cmc`, `type_line`, `oracle_text?`, `colors?`, `color_identity`, `power?`,
`toughness?`, `loyalty?`, `rarity`, `set`, `set_name`, `legalities` (format → `legal` /
`not_legal` / `restricted` / `banned`), and `price`. Double-faced and split cards carry their
faces joined with `" // "` in `oracle_text` and `mana_cost`.

`price` is one of:

```jsonc
{ "available": true,  "usd": "3999.00", "finish": "nonfoil" | "foil" | "etched" }
{ "available": false, "reason": "digital-only" | "no-price-data" }
```

Prices are strings; a missing price is reported as missing and never as `$0`. `digital-only`
means a digital printing won the rollup and carries no paper price — it is not "no price data".

**Failure result.** `isError: true`, and `content[0].text` is
`{"error":{"code":…,"message":…,"details"?:…,"status"?:…}}`. `code` is one of `bad_request`,
`not_found`, `rate_limited`, `upstream_unavailable`, `network`, `unexpected`. `details` is
Scryfall's own text, verbatim — it is the correction signal the failure loop reads.
**`not_found` does not reach the model for a zero-match search:** the handler maps Scryfall's
zero-match 404 to a *successful* empty result with a `note`.

**What the model already sees**, so the skill does not repeat it — the registered tool
description, verbatim from `src/tools/register.ts`:

> Search Magic: The Gathering cards using Scryfall query syntax, evaluated by Scryfall itself —
> supports all operators including `t:`, `o:`, `f:`, `cmc`, `usd`, `otag:`, `art:`, and regex
> (`o:/…/`). Returns per-card gameplay fields, format legalities, and a USD price with finish.
> 175 cards per page; the response reports `total_cards` and `has_more`.

Repo layout is unchanged from the Slice 1 doc; this slice adds only files under
`skills/scryfall-query-craft/` and one results doc.

## Out of scope — do NOT

- **Do not touch `src/`, `dist/`, `tests/`, `.mcp.json`, `plugin.json`, `marketplace.json`, or
  `README.md`.** No rebuild, no version bump, no tool-description edit (that is Slice 9's call to
  make if the measurement demands it).
- **Do not write evals, run evals, or claim a behavioral criterion.** PC-01 criteria 5–13 need
  fresh sessions and a baseline comparison; a self-assessment from the authoring session is the
  specific thing PC-01's method preamble rules out. Slice 9 owns them.
- **Do not run `claude plugin details` and record a cost figure.** That is Slice 10, and it needs
  the installed plugin.
- **Do not edit `docs/PLUGIN-PRD.md` or `docs/MCP-PRD.md`.** No open question resolves here. The
  only doc edits are the results file and the roadmap's status bookkeeping.
- **No second skill, no command, no agent, no hook.** PC-01 is one skill (PLUGIN-PRD P-07, §8).
- **No card data files, no bundled catalogs, no cached Scryfall payloads under `skills/`.**
  Reference files carry syntax, not corpora.
- **Do not provoke a 429 while verifying operators.** ≥600 ms between card-endpoint calls, one
  query at a time, no loops. A 429 locks access for 30 seconds and sustained overage risks the
  application being banned for every user (MCP-PRD §3.4). This is binding, not advisory.

## Acceptance criteria

1. **[PC-01 #1]** `description` + `when_to_use` measures ≤1,536 characters. The number and the
   counting rule are in the results doc.
2. **[PC-01 #3]** The `SKILL.md` body measures ≤5,000 tokens by the recorded instrument. The
   measurement names the instrument. If the number exceeds the ≤2,000 target, the results doc
   records why the excess is unavoidable and what was moved to `reference/` before settling.
3. **[PC-01 #4]** A fresh reviewer with no authoring context runs requirement 20's seven-point
   checklist over `SKILL.md` and every `reference/` file and finds no card facts. The reviewer,
   the verdict, and every line changed in response are recorded.
4. The body demonstrably covers all seven required content items — strategy (req 9),
   high-frequency operators (10), failure loop (11), non-existent operators (12), `unique` /
   `order` / `dir` (13), narrow-don't-page (14), and an explicit read trigger for each reference
   file (6). A reviewer can point at the lines for each.
5. Every operator named as real in any skill file is either in MCP-PRD §4.1.1's verified table
   or in the results doc's verification log with a date and an observed outcome. No exceptions,
   no "obviously correct" ones.
6. Every tool mention in every skill file uses `mcp__plugin_manabase_mtg__card_search`
   (verification step 3 returns nothing, or only lines that deliberately explain the scoping and
   are justified in the results doc).
7. Parameter names, defaults, and result field names in the skill match
   `src/tools/register.ts` and `src/tools/card-search.ts` exactly — checked by reading both, not
   by memory.
8. `claude plugin validate . --strict` passes, and `npm run typecheck` and `npm test` still pass
   unchanged (67 tests, 19 suites) — evidence that this slice touched no code.
9. `git diff --stat` shows changes only under `skills/`, `docs/slices/`, and the one roadmap row.
   `dist/index.js` is byte-identical. Both `.gitkeep` placeholders are deleted.

## Testing requirements

There is no unit test for a markdown file, and pretending otherwise would be the wrong shape.
The evidence here is **three measurements and one review**, all recorded:

- the character count (verification step 1) — an exact number, not an estimate;
- the token count (verification step 2 or a better instrument) — with the instrument named;
- the operator verification log — every operator not already in MCP-PRD §4.1.1's table, checked
  by one polite live call through the built server and recorded with its outcome;
- the fresh-reviewer card-fact review (requirement 20).

`npm test` is run only to prove the tree is otherwise untouched; it asserts nothing about the
skill. The behavioral evidence — does the skill fire, does it emit the right operators — cannot
be produced in this session at all: PC-01's method requires fresh sessions against a recorded
without-skill baseline, and authoring context masks exactly the gaps the eval is looking for.
Slice 9 does that work. **Do not write a "seems to work" note in place of it.**

## Verification steps

Git Bash. Steps 1–4 are the measurements; step 5 is per-operator and only for operators outside
MCP-PRD §4.1.1's verified table. These are one-off commands and none of them is committed — if
your shell mangles the embedded JavaScript, write it to a scratch file outside the repo and run
`node <file>` instead. An unquoted `>` inside a `node -e` snippet does not error: the shell reads
it as a redirect and silently creates a junk file where you expected a number.

```bash
# 1) description + when_to_use character count  (PC-01 #1 — cap 1,536; aim <=1,000)
node -e '
const fs = require("fs");
const src = fs.readFileSync("skills/scryfall-query-craft/SKILL.md", "utf8");
const fm = src.split(/^---\s*$/m)[1] || "";
const lines = fm.split(/\r?\n/);
function field(k) {
  let i = -1;
  for (let n = 0; n < lines.length; n++) { if (lines[n].indexOf(k + ":") === 0) { i = n; break; } }
  if (i < 0) return "";
  let v = lines[i].slice(k.length + 1);
  for (let j = i + 1; j < lines.length && /^\s+\S/.test(lines[j]); j++) v += " " + lines[j].trim();
  return v.trim().replace(/^[|\u003e]-?\s*/, "").replace(/^"|"$/g, "");
}
const d = field("description"), w = field("when_to_use");
console.log("description", d.length, "| when_to_use", w.length, "| combined", (d + " " + w).length);
'
# Eyeball the extracted values against the file if the frontmatter uses block scalars.

# 2) SKILL.md body size  (PC-01 #3 — ceiling 5,000 tokens, target 2,000)
node -e '
const fs = require("fs");
const src = fs.readFileSync("skills/scryfall-query-craft/SKILL.md", "utf8");
const body = src.split(/^---\s*$/m).slice(2).join("---");
console.log("body characters", body.length, "| pessimistic tokens", Math.ceil(body.length / 3.5));
'
# Prefer a real tokenizer if one is available; record which instrument produced the number.

# 3) scoped-name check — every tool mention must carry the harness prefix
grep -rn "card_search" skills/ | grep -v "mcp__plugin_manabase_mtg__card_search"
# expect: no output. The filter is line-based — eyeball any survivors.

# 4) card-fact prefilter — every hit must be justified line by line in the results doc
grep -rniE '\$[0-9]|[0-9]{1,3},[0-9]{3}|\b(banned|restricted|legal in|combos? with|staple|best)\b' skills/
# This is a prefilter, NOT the review. Requirement 20's fresh reviewer is the review.

# 5) verify one operator through the built server (>=600 ms between calls, one at a time).
#    NOTE: over raw stdio the tool is the bare `card_search` — the scoped name is the harness's
#    doing and does not apply here. Do not "fix" it.
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"card_search","arguments":{"q":"OPERATOR_UNDER_TEST"}}}' \
 | node dist/index.js
# A 400 with "All of your terms were ignored." is proof the operator does not exist.

# 6) standing gates — the tree must be otherwise unchanged
npm run typecheck && npm test
claude plugin validate . --strict
git diff --stat            # expect: nothing under src/ or dist/
git add -A && git status
```

## References

- `docs/DEV-ROADMAP.md` §4, Slice 8 (goal and done-when source); §5 (why this slice needs only
  Slice 3); §3 (standing rules — never restated per slice).
- `docs/PLUGIN-PRD.md` PC-01 (behavior and criteria 1–4; 5–13 are Slice 9's), §3.1 (context
  budget — the 1,536-character cap and the 5,000-token compaction window), §3.6 (skills carry
  instructions, never facts), §4.1 (skills, supporting files, `${CLAUDE_SKILL_DIR}`, scoped tool
  names, `/reload-plugins` for a marketplace-installed plugin), §3.2 (harness version floor),
  §4.6 (how `plugin details` produces its numbers), P-07, P-12.
- `docs/MCP-PRD.md` OQ-01 (the syntax-surfacing bet this slice makes and Slice 9 measures),
  CAP-01 (field list, pagination, meaning-changing parameters, structured failures), §4.1.1
  (verified operators, the invalid `illustrationtag:`, and counts that drift), §4.1.3 (the price
  traps behind `PriceInfo`), §3.4 (rate limits are binding while verifying operators), D-07,
  D-10.
- `docs/slices/TrackA-Slice6-results.md` — the live evidence behind every operator and price
  behavior the skill is allowed to assert.
- `docs/slices/TrackA-Slice3.md` and `TrackA-Slice5.md` — canonical `CardSearchData` /
  `PriceInfo` shapes and the registered tool definition.
