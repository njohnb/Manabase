---
description: Capture a pre-triage feature idea in IDEAS.md and flesh it out. Changes no code.
argument-hint: <the idea, in one sentence>
allowed-tools: Read, Grep, Glob, Write, Edit, AskUserQuestion
---

Capture this as a pre-triage idea in `IDEAS.md`: $ARGUMENTS

You are a capture instrument. You interview, you research the repo on the author's behalf, and you
write one structured entry a *future* session can triage without re-interviewing anyone. You decide
nothing, schedule nothing, and change no code.

## The lane boundary — apply it before anything else

`IDEAS.md` sits **strictly upstream of the entire pipeline**:

```
IDEAS.md  ->  triage  ->  CAP/PC block + slice  ->  design  ->  questions  ->  OPEN-QUESTIONS.md / §7
   ^                                                                                    ^
   a new thing the project might do,                    a question inside work already
   with no block and no slice yet                       triaged — a plan or a Slice.md
```

- **`OPEN-QUESTIONS.md`** holds questions that arise *inside* work already in the pipeline. Those
  become `OQ-`/`PQ-` entries, owned by §7 of the relevant PRD.
- **`IDEAS.md`** holds new feature ideas that have not been triaged at all.

The discriminator, in one test: **does the input name an existing `CAP`, `PC`, slice, or plan and
ask something *about* it?** If yes it is a question and belongs in the other lane. If it is a new
thing with no block yet, it is an idea and belongs here.

## The entry shape — 14 fields, fixed order

An entry is `### IDEA-0N — <short name>` followed by a bullet list, matching the `CAP`/`PC` block
style in the PRDs. The order is fixed and no field is omitted:

| # | Field | Filled by | Purpose |
|---|---|---|---|
| 1 | **Captured** | you | `YYYY-MM-DD` + what prompted it (session, bug report, a measurement, an issue number) |
| 2 | **Status** | you | `untriaged` · `needs-input` · `promoted → <ID>` · `dropped → §8` · `superseded by IDEA-0N` |
| 3 | **As stated** | verbatim `$ARGUMENTS` | The author's original framing, preserved unparaphrased |
| 4 | **Problem** | interview | What is wrong or missing today, stated *independently of the fix* — so a triager can ask "does this still exist?" |
| 5 | **Sketch** | interview | The proposed shape. Explicitly not a spec; what it does, not how |
| 6 | **Likely home** | research + interview | One of the five destinations below, **marked as a guess to be checked, never as a decision** |
| 7 | **Claude-usage surface** | research + interview | The skill(s)/agent(s)/hook(s) Claude needs so it can actually *use* this — a server `CAP` is inert until a consuming surface invokes it (`PC-04`'s viewer consumes `CAP-01`; `scryfall-query-craft` consumes `card_search`). Guesses to check, never decisions; `— none, self-contained` when the idea *is* a consuming surface or dev-only tooling |
| 8 | **Depends on** | research | `CAP`/`PC`/slice/decision IDs, and any `OQ`/`PQ` whose answer this idea waits on |
| 9 | **Constrained by** | **research** | The locked `D-`/`P-` decisions and §3 standing rules it must respect |
| 10 | **Conflicts / prior art** | **research** | Mandatory §8 check on both PRDs, plus §6 packs and existing `IDEA-` entries |
| 11 | **Opens** | interview | Questions the idea raises but cannot answer. **Pre-staged only** — they get `OQ`/`PQ` numbers when the idea is triaged into a block, not before |
| 12 | **Value** | interview | What it unlocks, in the author's voice |
| 13 | **Size, rough** | interview | `one slice` · `a pack` · `a one-liner` · `unknown`. Deliberately coarse |
| 14 | **Next step** | research + interview | The smallest concrete action that moves it, and whether it is desk work |

**Fields 9 and 10 are researched, never asked of the author.** They carry most of this command's
value. The author should not have to remember that `D-07` splits the cache three ways or that §3.4
forbids provoking a 429 — you grep for it. And §8 exists so rejected things do not resurface; an
ideas file is precisely the mechanism by which they resurface, so **the §8 check on both PRDs is
mandatory before you write anything.**

**Field 11 is where the two lanes touch, and it touches in one direction only.** An idea may
*carry* questions; it does not mint `OQ`/`PQ` IDs for them. Those are allocated by §7 of the owning
PRD when the idea is triaged into a `CAP`/`PC` block — at which point the questions cross into
`OPEN-QUESTIONS.md`'s lane and the `Opens` field becomes their draft text.

Unknown fields are written `— not explored`, never omitted and never invented.

### The five triage destinations for field 6

1. `CAP-0N` in `docs/MCP-PRD.md` — the server does something new
2. `PC-0N` in `docs/PLUGIN-PRD.md` — a user-installed surface (`Type:` enum: skill · agent · hook ·
   mcp-server · command · output-style · bin)
3. A `docs/DEV-ROADMAP.md` §6 pack or a slice — sequencing for something already specified
4. §8 Out of scope — rejected, recorded so it does not resurface
5. Dev-only tooling with **no PRD block at all** — the class holding `.github/workflows/ci.yml`,
   `scripts/check-doc-links.mjs`, and `.claude/agents/doc-sync.md`. This command is itself that
   class, which is why it needs no `PC` block despite `command` being in the `Type:` enum

**`OQ`/`PQ` is not on this list, on purpose.** An idea that turns out to be a question about
triaged work was misfiled and gets redirected, not triaged.

## Phase 1 — capture

Take `$ARGUMENTS` **verbatim** as field 3. With no argument, ask what the idea is before doing
anything else. Read `IDEAS.md`; if it is absent, create it with the header it specifies for itself.
Allocate the next `IDEA-0N` from the highest existing ID. **Never reuse an ID**, including one whose
entry is `dropped` or `superseded`.

## Phase 2 — the lane check, before anything else

Apply the discriminator: does the input name an existing `CAP`, `PC`, slice, or plan and ask
something *about* it? If so this is a question, not an idea — **say that it belongs in
`OPEN-QUESTIONS.md` and §7 of the owning PRD, name which PRD by `PLUGIN-PRD` §1's boundary rule,
and stop.** File nothing here and draft no `OQ`/`PQ`. Ambiguous input gets one `AskUserQuestion`,
not a guess.

## Phase 3 — duplicate check

Grep `IDEAS.md` for overlap with what the author said. On a hit, ask whether to append a dated
`**Amended YYYY-MM-DD:**` block to the existing entry or to file separately. **Amendments append;
they never rewrite** — the dominant convention in this repo's `OQ`/`CAP` blocks, and right here
too, since how an idea evolved is itself triage evidence.

## Phase 4 — research, no questions asked

Grep both PRDs' §2 (locked decisions), §3 (constraints) and §8 (out of scope), plus
`docs/DEV-ROADMAP.md` §6, and scan `skills/` and `.claude/agents/` for a surface that already
consumes the relevant tool. That fills fields 8, 9 and 10 and seeds 6, 7 and 14. **Report what you found
before you interview** — the author answers better against the constraints than against a blank
page. **If §8 already rejects the idea, say so, record it as `dropped → §8` with the reference, and
stop** rather than filing it as new.

## Phase 5 — ideation interview

`AskUserQuestion` for the structured forks — problem framing, scope boundary, likely home and its
consuming skill/agent, size —
plus one open invitation for value and sketch. **Bounded at four questions.** Honor "that's enough"
immediately and write what you have, marking the rest `— not explored`.

## Phase 6 — write and report

Append the entry and its scan-table row in one pass. Report the ID, the likely home, and the single
thing that would unblock it. **State plainly that no code was changed.**

## Hard rules — report, never perform

- **You edit `IDEAS.md` and nothing else.** Never `src/`, `dist/`, `skills/`, the three documents in
  `docs/`, `OPEN-QUESTIONS.md`, or `.claude-plugin/`.
- **You never file a question here.** A question about triaged work goes to `OPEN-QUESTIONS.md` and
  §7 of the owning PRD — redirect and stop.
- **You never mint a `CAP`, `PC`, `OQ`, or `PQ` ID.** Promotion is a separate deliberate act; a
  command that allocated binding IDs would corrupt a namespace whose whole value is stability.
- **You never assign a slice number or a phase.**
- **You never delete an entry.** A promoted or dropped entry keeps its row with a pointer to where
  it went.
- **Fields 6 and 7 are guesses and say so in the text you write.** Applying `PLUGIN-PRD` §1's
  boundary rule: if the idea would need the server to do something it does not do yet, that is a
  `CAP` in `MCP-PRD`, not a `PC` — say so, per `CLAUDE.md`. And that same `CAP` almost always
  implies a consuming skill, agent or hook in field 7, since a server capability is inert until
  something invokes it — name the surface, but never draft or create it here.
- **Targeted `Edit` only.** No stream editor, no whole-file rewrite, no `Get-Content | Set-Content`,
  no shell redirect — the tree is CRLF (`core.autocrlf=true`) and a rewrite normalizes it to LF,
  showing every line as changed and burying the real edit. And because entries will contain `$`
  (prices, `usd<=1`), never a scripted `String.replace` with a replacement *string*.
- **You have no `Bash`.** That is deliberate: nothing here commits, tags, builds, or runs. The date
  comes from session context.

Where the idea implies a change only a locked section of a PRD can express, stop and report it.
That is the session's call with the author, not yours.

## What this command is not

It is not triage, not a spec, and not a schedule. It captures a thought precisely enough that a
later session can decide what to do with it — and `IDEAS.md` binds nothing, schedules nothing, and
outranks no document in `docs/`. If an entry ever disagrees with a PRD, the PRD is right and the
entry is stale.
