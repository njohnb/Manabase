# Ideas — pre-triage

**This file binds nothing and schedules nothing.** An entry here is a thought, not a commitment.
The three documents in `docs/` are authoritative for everything an entry references; if an entry
disagrees with a PRD, the PRD is right and the entry is stale — fix it here, never there.

**The lane boundary comes first, because it is the part a cold session gets wrong.** This file sits
strictly *upstream* of the pipeline:

```
IDEAS.md  ->  triage  ->  CAP/PC block + slice  ->  design  ->  questions  ->  OPEN-QUESTIONS.md / §7
   ^                                                                                    ^
   a new thing the project might do,                    a question inside work already
   with no block and no slice yet                       triaged — a plan or a Slice.md
```

A question that arises *inside* work already triaged belongs in `OPEN-QUESTIONS.md` and §7 of the
owning PRD, **never here**. An idea here has no `CAP`, no `PC`, no slice, and no phase. The
discriminator is one test: *does it name an existing `CAP`, `PC`, slice, or plan and ask something
about it?* If yes it is a question and it is in the other lane.

It exists because the pipeline starts at "append a `CAP`/`PC` block", and there was nowhere to hold
something that has not earned one. An idea's only legal resting place before this file was a block
with `Phase: unassigned` — which already requires the idea to be well-formed enough to earn a block.
Anything below that bar became narrative prose in `docs/DEV-ROADMAP.md` §2 or a sentence buried
inside a slice entry, findable only by grep, listed nowhere.

**An entry is never deleted.** A promoted or dropped entry keeps its row with a pointer to where it
went. This mirrors §7's rule that questions stay until answered — they are not dropped.

**`IDEA-` is deliberately outside the binding ID namespaces** (`D-`, `P-`, `CAP-`, `PC-`, `OQ-`,
`PQ-`) so an idea ID can never be mistaken for a decision. IDs are stable and never reused,
including one whose entry is dropped or superseded.

Entries are `### IDEA-0N — <short name>` followed by a fixed 13-field bullet list, matching the
`CAP`/`PC` block style. `.claude/commands/idea.md` defines the fields, and researches two of them —
`Constrained by` and `Conflicts / prior art` — rather than asking the author.

`Ready to triage?` below answers one specific question, the analog of `OPEN-QUESTIONS.md`'s proven
"Settle now?" column: *can this be moved forward at a desk, or does it need a live harness, a third
party, or a capability that does not exist yet?*

| ID | Idea, short | Captured | Likely home | Status | Ready to triage? |
|---|---|---|---|---|---|
| [IDEA-01](#idea-01--cache-scryfall-responses-in-process) | Cache Scryfall responses in-process | 2026-08-10 | `CAP` in `MCP-PRD` — guess | untriaged | **Yes — desk work** |
| [IDEA-02](#idea-02--auto-release-on-merge-to-main) | Auto-release on merge to main | 2026-08-25 | Amends `PC-03` in `PLUGIN-PRD` — guess | promoted → [Slice 18](./docs/slices/TrackC-Slice18.md) | **Triaged 2026-08-25 — see the amendment** |

---

### IDEA-01 — Cache Scryfall responses in-process

- **Captured:** 2026-08-10 — session, while building `/idea` itself. First entry in this file.
- **Status:** untriaged
- **As stated:** "caching and combining multiple scryfall queries into 1 "list" query to save time
  and api calls"
- **Problem:** Every card-endpoint call shares one 2/second lane, and nothing anywhere memoizes a
  response. Four costs follow, and they are independent of any fix: a multi-query session spends
  seconds purely in throttle; an identical query re-issued within a session spends a rate-limit slot
  on an answer already held; that spend counts against a budget where sustained overage risks the
  application for **every** user, not just this one; and a repeated large payload is paid twice in
  context, which is issue #25 territory — 111 cards measured 116,626 characters, already over a
  harness tool-result ceiling.
- **Sketch:** An in-memory response cache living inside the server process, constructed at
  `src/index.ts` and passed down beside the client, fronting `client.get` so every card endpoint
  benefits rather than `cardSearch` alone. A hit costs no request and no rate-limit slot. Scope is
  the process: it lives and dies with the stdio server and persists nothing. **It stores responses
  Scryfall computed; it never evaluates a query** — see the guardrail in `Conflicts / prior art`.
  Not a spec.
- **Likely home:** `CAP` in `docs/MCP-PRD.md` — **a guess to be checked, not a decision.** It
  changes what the server does, so by `PLUGIN-PRD` §1's boundary rule it cannot be a `PC`;
  `PLUGIN-PRD` §8 says the same from the other side ("any component that requires the server to do
  something `docs/MCP-PRD.md` does not specify … is a CAP in that document"). The open sub-question
  a triager owns: whether this is a **new `CAP`** or an **amendment to `D-07`**, which is already
  the cache decision and already three-way.
- **Claude-usage surface:** **A guess to be checked, not a decision.** *No new surface* — the cache
  fronts `client.get` beneath `card_search`, so `scryfall-query-craft` (the skill that already turns
  plain English into a `card_search` call) reaches a cached response through the identical tool call,
  with no skill, agent, or hook change. It is **not** `— none, self-contained`: this idea is neither
  a consuming surface nor dev-only tooling, it is a server-internal capability whose *existing*
  consumer suffices. One seam to watch: the `Opens` entry "Is a cache hit visible to the model, or
  silent?" — if a hit is ever surfaced (a result field, a `note`), that is the first thing that
  would pull `scryfall-query-craft` into scope, because the skill would then have to teach the model
  what a hit means for staleness. Until that question is answered, the transparent path needs
  nothing built.
- **Depends on:** `CAP-01` — the only delivered capability, and what a cache would front. Nothing
  else blocks it: choosing in-process scope deliberately avoids `OQ-03`'s open refresh-trigger half,
  `PQ-03`, and the §6 Tag discovery pack that owns the persistence decision. **Not blocking but
  order-sensitive:** `OQ-02`'s answered-but-unimplemented page cap and `legalities` enum both change
  what a correct cache key contains, so landing them after a cache means revising the key.
- **Constrained by:**
  - **`D-03` — the sharp one.** No per-user state in module-level variables; config is read once at
    the entry point and passed down; handlers stay callable as plain functions in a test with no
    server started. The obvious implementation — a module-level `Map` — is forbidden by the
    decision that makes this codebase testable.
  - **§3.4** — 2/second on `/cards/search|named|random|collection`, 10/second elsewhere; a 429 locks
    access 30 seconds and sustained overage risks banning the application. Note the direction: a
    cache *reduces* request volume, so it is aligned with this constraint rather than in tension
    with it.
  - **`D-10`** — a cache miss, eviction, or corruption returns a structured failure. It never
    throws.
  - **`D-07`** — the existing three-way split this extends rather than replaces.
  - **§3.5** — if tag data is ever cached, track tags by `id` UUID; slugs are not stable
    identifiers.
- **Conflicts / prior art:** **Checked §8 of both PRDs 2026-08-10 — not rejected.** One adjacent
  rejection is the guardrail: `MCP-PRD` §8 rejects **"Reimplementing Scryfall's search engine
  locally,"** naming `D-07` as the reason that rejection exists. Caching responses is open; a cache
  that grows into local query evaluation is already out of scope. `PLUGIN-PRD` §8 inherits that list
  unchanged. Prior art that a triager must read first: **`D-07` is already the caching decision**
  (live `/cards/search` for query evaluation, live `/cards/collection` for known names at 75/batch,
  bulk files for corpora). **The batching half of "As stated" is already decided and was carved off
  this entry deliberately, not lost** — `MCP-PRD` §4.1.2 records `POST /cards/collection` at 75 per
  request as "the pricing primitive: a 100-card decklist is 2 requests, ~1 second. Any queued
  capability that prices a list should use this, never a loop over `/cards/named`", and
  `DEV-ROADMAP` §6 repeats it as a standing reminder for every future pack while the Decklist
  pricing pack is already specced against it. That half needs a capability to *use* it, not a new
  idea. Neither the Decklist pricing nor the Tag discovery pack is this. No other `IDEA-` entry
  existed when this was filed.
- **Opens:** *(pre-staged only — these get `OQ` numbers if and when this is triaged into a block)*
  - **What is the cache key?** It must carry every parameter that changes the result — normalized
    `q`, `unique`, `order`, `dir`, `page`, and the `legalities` enum once `OQ-02` ships. A key that
    omits one returns a confidently wrong result from cache, which is the same silent-wrong-answer
    class as Scryfall's dropped-invalid-term and `\A`-returns-zero traps.
  - **What TTL, given a cached search response embeds prices?** `D-07`'s own rationale already
    splits freshness — Scryfall's docs call bulk prices dangerously stale after 24 hours while
    gameplay data needs only weekly refresh — so a single uniform TTL over a payload containing both
    is wrong in one direction or the other.
  - **Is a capped response cacheable as though complete,** once `OQ-02`'s ~120-card page cap exists?
  - **Is a cache hit visible to the model,** or silent? A silent hit cannot be distinguished from
    fresh data when staleness matters.
- **Value:** Less waiting, fewer calls against a 2/second budget, and not paying twice in context
  for an answer already fetched.
- **Size, rough:** one slice
- **Next step:** Decide the cache key, TTL, and eviction bound at a desk — the `Opens` above are the
  agenda, and the TTL question is already half-answered by `D-07`'s freshness split. **Desk work: no
  harness, no live API, no third party.** Choosing in-process scope is what makes this settleable
  now rather than behind the persistence decision.

---

### IDEA-02 — Auto-release on merge to main

- **Captured:** 2026-08-25 — session, from a direct question by the author. Prompted by the state
  of the release namespace rather than by a bug report: Slices 15–17 added `combo_search` and
  `combo_find_deck`, and the newest release predates all three.
- **Status:** promoted → [Slice 18](./docs/slices/TrackC-Slice18.md), 2026-08-25
- **As stated:** "capture the auto-release on merge to main" — original framing in the same session:
  "i'd like to get an automatic release pushed on merge to main. what do i need to complete to make
  this possible?"
- **Problem:** Cutting a release is a hand-pushed `v*` tag and nothing prompts it. `ci.yml` runs on
  every push to `main` and never releases; `release.yml` fires only on the tag. Three costs follow,
  and all three are independent of any fix. **Merged work does not ship** — `v0.1.0` and `v0.1.1`
  are the only releases and both predate Slices 15–17, so no bundle anyone has installed carries
  either combo tool. **Nothing corrects that over time**, because an installed `.mcpb` never
  re-pulls, so the gap between `main` and what a user runs widens by one merge at a time with no
  signal in either direction. And **the version is typed by hand at the one moment that cannot be
  undone** — a released bundle cannot be withdrawn, and `0.1.01` is not semver yet satisfies the
  `\d+` guard in `scripts/pack-mcpb.mjs`, a near-miss already recorded from the `v0.1.1` session.
- **Sketch:** A job on `push: main` that decides whether a release is due and, if it is, tags and
  publishes in the same job. `package.json`'s `version` is the source of truth, compared against the
  previous commit: unchanged means skip silently, changed means tag `v<version>` and publish. Same
  job rather than two, because the default `GITHUB_TOKEN` does not start a second workflow. The
  author's scope call is that the same move also sets `plugin.json`'s `version` — **executing the
  switchover `P-08` already provides for, not amending it**. Not a spec.
- **Likely home:** An amendment to **`PC-03`** in `docs/PLUGIN-PRD.md` — **a guess to be checked,
  not a decision.** `PC-03` owns the bundle and the release path that delivers it, and the plugin
  half touches `plugin.json`, which is squarely that document's. By `PLUGIN-PRD` §1's boundary rule
  it is **not** a `CAP`: it asks nothing new of the server. **The competing reading a triager should
  weigh** is the dev-only tooling class with no PRD block at all — where `.github/workflows/ci.yml`
  and `scripts/check-doc-links.mjs` already sit, and where `release.yml` itself sits today, having
  never earned a block. **A third possibility is that the plugin half is not this entry's at all**
  but Slice 13's, in which case what remains here is bundle-only and much smaller.
- **Depends on:** `PC-03` — criterion 8 is its one unverified criterion, and proving this idea works
  passes through the same Desktop install. **Slice 13's `P-08` half**, itself gated on Slice 12's
  second cold run with a different person: the plugin-version half cannot land before it. `PQ-09` —
  answered, and this consumes its answer rather than waiting on it. `PQ-06`'s user-facing half is
  open and not blocking, but this idea makes more of the artifact that question describes. **Not
  blocking, order-sensitive:** `mcpb/manifest.json` declares one tool while `src/tools/register.ts`
  registers three, and `APP_VERSION` in `src/config.ts` is hand-synced and still reads `0.0.0` in
  every outbound `User-Agent`. Both are wrong today and both would ship on the first automatic
  release.
- **Constrained by:**
  - **`P-08` — the sharp one, and not in the way it first reads.** It leaves `version` unset during
    development and sets explicit semver at first public release, calling the switchover a phase
    boundary. So the plugin half **does not amend a locked decision** — it performs what the
    decision already specifies. What it does collide with is *timing*: that switchover is Slice 13's
    and is gated behind a cold-install run that has not happened.
  - **§4.3** — the version resolution order, and the prohibition that matters here: **never set
    `version` in both `plugin.json` and the marketplace entry, because `plugin.json` wins
    silently.** The plugin half writes exactly that field.
  - **§4.3 again** — `claude plugin tag` creates a `v*` release tag, the same namespace an automatic
    releaser would watch. Two producers, one namespace.
  - **`P-09`** — `dist/` is committed and rebuilt with every `src/` change. Both workflows gate on
    `git status --porcelain -- dist/`, and that gate must stay ahead of the pack step; automation
    that reorders it reintroduces the failure `PQ-06`'s commit half closed.
  - **`PC-03` criterion 7** — the pack script unpacks the archive it just wrote and sha256-compares
    `server/index.js` against committed `dist/index.js`, deleting the bundle on a mismatch. It lives
    in the script rather than a workflow step deliberately; automation must call the script, never
    reimplement the assertion.
  - **`P-14`** — one source, two distribution targets. A release serves the bundle target; the
    plugin target updates by `/plugin update` and is a different mechanism.
  - **`MCP-PRD` §3.4** — `npm run acceptance` is excluded from CI on purpose, because it calls live
    Scryfall and a 429 risks the application for every user. An automatic release therefore ships
    without a live pass **by design, not by omission** — but it removes the human who currently runs
    it before a deliberate release.
- **Conflicts / prior art:** **Checked §8 of both PRDs 2026-08-25 — not rejected.** Neither list
  touches CI, releases, or versioning; `PLUGIN-PRD` §8's nearest entries are about *hosting* a
  marketplace and about npm source types, neither of which is this. No `DEV-ROADMAP` §6 pack covers
  it — every pack there is a capability pack. `IDEA-01` is unrelated. **The prior art that binds is
  `PQ-09`, and it cuts against the sketch.** Answered 2026-08-04: the pack step stamps the version
  from a tag or `MANABASE_BUNDLE_VERSION`, and it **explicitly rejected tracking `package.json`**
  because that "adds the fourth hand-synced copy directly"; its stated virtue was that "no human
  writes the number anywhere." The sketch above makes `package.json` the source and so reintroduces
  a hand-written number. **The counter-reading a triager must weigh, because it is not obviously
  wrong:** the tag is hand-typed today, so the number of human-written versions may be unchanged
  rather than increased — and tying `APP_VERSION` to `package.json` in the same move would *reduce*
  it from two to one. Not settled here. Also prior art: `PQ-06`'s commit half is answered by
  `ci.yml` while its user-facing half is open and CI cannot close it, so automation adds releases
  without adding a staleness signal. `PQ-05` — submitting to a community marketplace — is a
  different question and is not this.
- **Opens:** *(pre-staged only — these get `PQ` numbers if and when this is triaged into a block)*
  - **What decides a release is due, and what does a merge that changes nothing do?** A doc-only
    merge must skip silently. `gh release create` fails on an existing tag, so the naive form turns
    every documentation merge red.
  - **Does a tag pushed by a workflow start the release workflow?** The default `GITHUB_TOKEN` does
    not trigger further runs, which rules out a two-workflow split without a PAT or App token.
    **Unverified in this repo** — stated from documented GitHub behavior, not measured here.
  - **What is the first automatic version?** `v0.1.0` and `v0.1.1` are spent, neither carries the
    combo tools, and a released bundle is never moved or deleted.
  - **Does the plugin half belong to this entry or to Slice 13?** Both cannot own `P-08`'s
    switchover.
  - **What stops `mcpb/manifest.json`'s tool list and `APP_VERSION` from shipping stale?** Both are
    hand-maintained, both are wrong today, and an automatic release publishes whatever is there.
  - **Does removing the human from the release step change what §3.4's acceptance exclusion means?**
    Today a person runs `npm run acceptance` once, deliberately, before cutting a release.
  - **What happens when two merges land close together?** Without a concurrency group they race the
    same tag, and the loser fails after the artifact is built.
- **Value:** Merged work reaches the people who installed it without the author remembering to type
  a tag. Two tools exist today that nobody outside this repo can use.
- **Size, rough:** one slice
- **Next step:** Decide the version source and the skip rule at a desk, **against `PQ-09`'s answer
  rather than around it** — that is the one fork everything else follows from, and it is the field
  above where this entry most expects to be corrected. **Desk work for the bundle half: no harness,
  no live API, no third party.** **Not desk work for the plugin half** — `P-08`'s switchover is
  Slice 13's, gated on Slice 12's second cold run with a different person, and proving the result
  needs a Desktop install, which is `PC-03` criterion 8 anyway. Two defects are worth fixing
  regardless of how this is triaged, because they ship on the first automatic release either way:
  the manifest's one-tool list and `APP_VERSION`'s `0.0.0`.

**Amended 2026-08-25 — triaged the same day it was filed, and the `Next step` field's own fork was
decided against this entry.** Promoted to [Slice 18](./docs/slices/TrackC-Slice18.md), which builds
both halves and executes the [`P-08`](./docs/PLUGIN-PRD.md#p-08--version-scheme) switchover. Four
things changed and the fields above are left as written.

1. **The version source is `plugin.json`, not `package.json`.** The `Sketch` and `Next step` fields
   above name `package.json`, and `Conflicts / prior art` flagged that as the entry's weakest point.
   It was: [Slice 13](./docs/slices/TrackC-Slice13.md) requirement 5 forbids syncing `package.json`
   to the plugin version — twice, deliberately — because
   [`P-09`](./docs/PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript) rejected `npx` to
   avoid two numbers bumped in lockstep. Sourcing from `plugin.json` leaves `package.json`
   independent at `0.0.0`, leaves `APP_VERSION` mirroring it, and **dissolves
   [`PQ-09`](./docs/PLUGIN-PRD.md#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08)'s
   fourth-copy objection** rather than arguing past it — one authored number reaches the plugin, the
   tag and the bundle.
2. **The number is computed, not typed.** `scripts/bump-version.mjs` reads conventional commits from
   the last `v*` tag to `HEAD`. That answers `PQ-09`'s "no human writes the number anywhere" in the
   letter as well as the spirit, which neither reading in `Conflicts / prior art` anticipated.
3. **The `Opens` field's second bullet is answered and its fourth is decided.** The `GITHUB_TOKEN`
   recursion guard is turned from an obstacle into the mechanism — the tag is pushed inside the same
   job, so nothing needs to trigger anything — and the plugin half belongs to
   [Slice 18](./docs/slices/TrackC-Slice18.md) rather than to
   [Slice 13](./docs/slices/TrackC-Slice13.md), which keeps only its
   [`PQ-05`](./docs/PLUGIN-PRD.md#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable)
   disposition and its Phase 1 closing row.
4. **`Depends on` inverted.** This entry recorded that the plugin half "cannot land before"
   [Slice 12](./docs/slices/TrackC-Slice12.md)'s second cold run.
   [Slice 18](./docs/slices/TrackC-Slice18.md) inverts that gate deliberately and argues it in its
   own *Why this slice exists* section; [Slice 12](./docs/slices/TrackC-Slice12.md) now runs
   **after**, so the cold reader installs the automated release rather than a bundle three slices
   stale.

**Built and rehearsed 2026-08-25 (the plugin and bundle halves both).** The
[`PC-03`](./docs/PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) amendment this entry's
`Likely home` guessed at is now written — [Slice 18](./docs/slices/TrackC-Slice18.md)'s requirement
10 — and adds criteria 12–14. The bump script, the manifest fix, the tests and the merge-triggered
[`release.yml`](./.github/workflows/release.yml) are built and verified locally; the three-merge
live sequence that publishes `v0.2.0` → *(no release)* → `v0.3.0` and flips those criteria to
verified is the author's, and no `PC-03` criterion is claimed verified ahead of it.
