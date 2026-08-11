# Card Viewer — Component Request and Build Spec

**Two-phase file, and the phases are different sessions.**

- **Part A** is a component request. Paste it into the slot in `04-add-plugin-component-prompt.md`
  and run that prompt. Its output is a PC block in `docs/PLUGIN-PRD.md` — no code.
- **Part B** is the build spec. It is only run *after* Part A has produced a specified PC
  block, and it builds against that block, not against this file.

**Do not run Part B first.** `04-add-plugin-component-prompt.md` exists because a component
specified from guesswork is worse than one that took an extra round trip, and this component
has a blocking dependency (§A.6) that Part A is the right place to resolve.

Facts marked **[verified 2026-08-11]** were read in live documentation on that date. Facts
about the plugin harness cited from `docs/PLUGIN-PRD.md` §4 carry that document's own
verification date of 2026-07-29 and are referenced, not restated.

---

# Part A — Component request

## A.1 The user need

I want to see the actual card while I'm working in a Claude Code session, without opening a
browser and navigating to Scryfall. When a search comes back with twelve cards, I want to look
at them — the art, the frame, whether it's the card I meant — not read twelve type lines and
take Claude's word for it.

## A.2 Why the obvious approach cannot work

This matters because it rules out an entire family of designs, and a session that does not
know it will propose one of them.

**Claude Code's TUI implements no terminal graphics protocol.** Sixel, kitty, and iTerm2
inline-image support was requested in `anthropics/claude-code` issue #2266 and closed without
implementation. **[verified 2026-08-11]** Tool output is re-rendered by Claude Code into its
own layout; graphics escape sequences never reach the terminal emulator. So piping `chafa`
output through the Bash tool produces nothing usable.

Two size limits exist and are a red herring — bash output is middle-truncated at 30,000
characters (`BASH_MAX_OUTPUT_LENGTH`) and MCP tool responses cap at 25,000 tokens
(`MAX_MCP_OUTPUT_TOKENS`). **[verified 2026-08-11]** Raising either changes nothing, because
the failure is rendering, not size. Even chafa's `symbols` output, which is plain text and
would survive the limit, is destroyed by the TUI reflowing it at its own content width.

**Any pixel that passes through the model's context or through Claude Code's renderer is
already lost.** The only workable shape is out-of-band: the image never enters that path.

There is also a wrong turn worth naming because it looks like the obvious answer. Returning
card images as MCP image content blocks sends the picture to the **model**, not to the user —
several hundred tokens per card, against a known 25,000-token wall on MCP image responses
(`anthropics/claude-code` issue #9152). **[verified 2026-08-11]** It is the exact inverse of
what is wanted, and it would be a `docs/MCP-PRD.md` change rather than a plugin one.

## A.3 Shape

- **Type: hook.** That is the only harness-registered surface. `docs/PLUGIN-PRD.md` §4.1 lists
  the component types a plugin may ship, and a background HTTP daemon is not among them — it
  ships as code under the plugin root that the hook manages. P-04's flat `PC-0N` scheme with
  type as a field accommodates this without inventing a component category.
- **Surface:** a `PostToolUse` hook matched on the search tool. It fires after a search, pushes
  card identifiers to a local daemon, and exits. The user reaches the result through a browser
  page on `127.0.0.1`, and optionally through a terminal pane.
- **This is the first hook component in the plugin.** `docs/PLUGIN-PRD.md` §6 anticipates it
  by name: *"the first component that needs a hook raises the cross-platform bar (§3.4): Phase
  1 deliberately ships no hook, so the first one to arrive owns the exec-form and Windows-shell
  problem rather than inheriting a solution."* That problem is this component's to solve, and
  §B.3 solves it.

## A.4 Why this is cheap in the terms §3.1 measures

`docs/PLUGIN-PRD.md` §4.6 records that hooks are reported as *"harness-only — no model context
cost."* This component ships no skill and no agent, so its **always-on cost is zero** and it
does not touch the shared skill-listing budget that §3.1 makes the primary constraint. Its
on-invoke cost is also zero: the hook runs outside the model loop and returns nothing to
Claude.

That is an unusually strong cost story and it should be stated plainly in the PC block rather
than left implicit — this is one of the few components that cannot be argued against on budget
grounds.

## A.5 Constraints it must be specified within

Each of these is inherited, not invented here. A specification that violates one is wrong.

| Constraint | Source | What it forces |
|---|---|---|
| Node on `PATH` is the **only** runtime prerequisite | §3.4 | **`chafa` cannot be required.** The browser front-end must work with nothing installed; the terminal front-end is an optional extra that degrades cleanly when `chafa` is absent. |
| Hooks must use **exec form** | §3.4 | A shell-form hook runs under `sh -c` on macOS/Linux but **Git Bash on Windows, or PowerShell when Git Bash is absent**. Exec form only — `command` plus `args`, no shell. |
| No writes under `${CLAUDE_PLUGIN_ROOT}` | P-06, PC-02 criterion 6 | The image and card caches live under `${CLAUDE_PLUGIN_DATA}`, which survives updates. `CLAUDE_PLUGIN_ROOT` is garbage-collected ~14 days after an update. |
| Committed built JavaScript, run by `node` | P-09 | Same build and distribution path as the server. No `npx`, no second version number, no network fetch at startup. |
| One repo, components at the root, source under `src/` | P-02 | The viewer is not a separate project. This is the change from the earlier draft of this file. |
| Scoped tool names | P-12 | The hook matcher must use `mcp__plugin_manabase_mtg__<tool>`. §4.1 states outright that *"a hook matcher or permission rule written against the bare server key never fires."* |
| Nothing the user would be surprised by | §3.3 | The daemon is a background process. It must be **opt-in and default off** — see §B.2. |
| Scryfall is the only price source | `docs/MCP-PRD.md` D-06 | See §B.6 on marketplace hyperlinks, which is adjacent to this and must be decided deliberately rather than drifted into. |

## A.6 The blocking dependency — read this before specifying anything

**CAP-01 does not return a Scryfall `id`.** Its behavior block in `docs/MCP-PRD.md` §5 lists
what comes back per card: *"name, mana cost, converted mana cost, type line, oracle text,
colors and color identity, power/toughness/loyalty where applicable, rarity, set, format
legalities, and price."* No identifier.

The hook needs a stable per-card handle to push. Without one there is nothing to extract from
the tool response, and `docs/PLUGIN-PRD.md` §1's third consequence applies directly: *"If a
component you want would require the server to do something it does not do yet, that is a CAP
in `docs/MCP-PRD.md`, not a PC here. Say so and stop."*

There are two ways through, and **this is the decision the Part A session must put to me
before writing the block.** Do not pick one silently.

**Option 1 — revise CAP-01 to include `id` per result.**

- *For:* exact, unambiguous, no text parsing. A stable identifier is independently useful to
  several queued capabilities — decklist pricing, combo discovery, and Arena export all want to
  name a specific card rather than a string.
- *Against:* it is a `docs/MCP-PRD.md` revision, run through
  `02-add-capability-prompt.md`, not something Part A can do. It also adds 36 characters per
  result to every search response, which is live territory for **OQ-02** (result verbosity vs.
  context budget) — that question should be answered rather than stepped over.
- *Consequence:* this component's PC block is written with `Status: proposed` and a blocking
  open question until the CAP-01 revision lands.

**Option 2 — resolve by card name.**

- *For:* no PRD change; CAP-01 already returns `name`. `POST /cards/collection` accepts `name`
  as an identifier (`docs/MCP-PRD.md` §4.1.2), so a batch of names resolves in one request.
  The component becomes specifiable immediately.
- *Against:* two real weaknesses. Names must be parsed out of the tool's text response, which
  is fragile and silently pushes wrong cards when it drifts. And name lookup selects a printing
  rather than being handed one — `docs/MCP-PRD.md` §4.1.3 trap 3 verified that
  `GET /cards/named?exact=Black+Lotus` returns the **MTGO** printing. For a viewer that is
  mostly cosmetic, but it means the image shown is not necessarily the printing the search
  matched.

**My lean is Option 1**, because the identifier is worth having for reasons beyond this
component and Option 2's parsing fragility is a bug source that will not announce itself. But
it is a `docs/MCP-PRD.md` change with a context-budget cost, so it is mine to decide, not the
session's.

## A.7 The `bin/` conflict — surface it, do not route around it

`docs/PLUGIN-PRD.md` §8 rejects `bin/` executables: *"Files in `bin/` become bare commands on
the Bash tool's `PATH` while the plugin is enabled. There is no command-line tool here worth
exposing, and adding names to a user's `PATH` is a larger imposition than the feature would
repay."*

An explicit push command — letting Claude say "show me these three cards" mid-conversation
rather than only after a search — would be exactly such a tool. That makes it a **reopening of
a §8 rejection**, not a detail.

**Recommendation: do not ship it in the first version.** The hook covers the case that
motivated this component, the §8 reasoning still holds for everyone who does not want the
viewer, and a component that reopens a rejection on its first outing should have to earn it.
Record it as an open question in §7 instead, so the argument exists if the hook turns out to be
insufficient in practice.

## A.8 Open questions the block should carry

- Which option in §A.6, and if Option 1, the `docs/MCP-PRD.md` revision is a prerequisite.
- Whether the explicit push justifies reopening §8's `bin/` rejection (§A.7).
- Whether marketplace hyperlinks are consistent with D-06 (§B.6) — my reading is yes, and it
  should be recorded as reasoned rather than assumed.
- Phase assignment. This is **not** Phase 1: `docs/PLUGIN-PRD.md` §6 fixes Phase 1 as PC-01 and
  PC-02 together and nothing else, and §3.5 requires Phase 1 to produce zero prompts and zero
  local state — a background daemon and an image cache are both.

---

# Part B — Build spec

**Gate: do not start until Part A has produced a PC block with `Status: specified`.** Build
against that block. Where this file and the block disagree, the block wins — it is the PRD,
this is a note.

## B.1 Architecture

```
Claude Code session                   viewer daemon               front-ends
─────────────────────                 ─────────────               ──────────
card_search returns ──▶ PostToolUse ──▶ POST /cards          ┌──▶ terminal pane
                        hook            │                    │    (chafa, optional)
                        (exec form)     ├─ resolve via ──┐   │
                                        │  Scryfall      │   │
                                        │                ▼   │
                                        ├─ cache in ─────────┤
                                        │  CLAUDE_PLUGIN_DATA│
                                        └─ GET /events ──────┴──▶ browser page
                                           (SSE)                  (127.0.0.1)
```

One piece of state: the current result set, an ordered list of resolved cards. Both front-ends
render it and update when it changes.

Files, following P-02 (components at the plugin root, source under `src/`):

```
src/viewer/
├── daemon.ts      # http server, SSE, state
├── resolve.ts     # collection lookup, face extraction (§B.5), link extraction (§B.6)
├── cache.ts       # ${CLAUDE_PLUGIN_DATA} card JSON + image bytes
├── watch.ts       # terminal front-end
├── page.ts        # browser page as one inlined HTML string
└── hook.ts        # PostToolUse entry point
hooks/hooks.json   # hook registration (§B.3)
```

Built into the same committed `dist/` as the server (P-09). It shares the plugin's version;
there is no second version number and nothing new to keep in sync.

## B.2 Opt-in, and why it is not negotiable

A background HTTP daemon spawned without asking violates §3.3 (*"must not do anything a user
would be surprised by"*). It is also install friction if the user has to launch it by hand,
which is the failure mode `docs/MCP-PRD.md` §3.1 names as the primary adoption risk.

**Resolution: a marker file in `${CLAUDE_PLUGIN_DATA}`, written once by the user.** When it is
absent the hook exits immediately having done nothing — no daemon, no network, no process.
When present the hook starts the daemon detached on first use if `/healthz` does not answer,
and pushes.

This is deliberately not `userConfig`. P-05 governs credentials, and this is not one; a
`userConfig` entry would also add a prompt at enable time for everyone including users who will
never turn the viewer on, which is what P-13 and §3.5 exist to prevent.

The README documents one line to enable it. That is the whole install.

## B.3 The hook — exec form, and it must never be felt

`hooks/hooks.json` at the plugin root:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "mcp__plugin_manabase_mtg__card_search",
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": ["${CLAUDE_PLUGIN_ROOT}/dist/viewer/hook.js"],
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

**Exec form is mandatory** — `command` plus `args`, spawned with no shell. §3.4 records that a
shell-form command runs under `sh -c` on macOS and Linux but Git Bash on Windows, or PowerShell
when Git Bash is absent. `node` is on `PATH` by §3.4's runtime rule, so exec form costs nothing
here.

The matcher uses the P-12 scoped form. §4.1: *"a hook matcher or permission rule written
against the bare server key never fires."*

**The hook exits 0 unconditionally.** Wrap everything. A daemon that is down, a marker file
that is absent, a malformed payload, a `card_search` whose output shape changed — none of these
may ever surface in the user's session. Swallow every error, append one line to a capped log in
`${CLAUDE_PLUGIN_DATA}`, exit 0.

**Log, or this is undebuggable.** The hook is silent by design, so without a log there is no
way to distinguish "matcher never fired" from "fired but extracted nothing" from "daemon
refused the connection." One line per invocation: timestamp, `tool_name`, count extracted, POST
result. Cap at ~1 MB.

**Verify the matcher empirically before trusting it.** P-12 gives
`mcp__plugin_manabase_mtg__card_search` and that should be right, but a wrong matcher fails
*silently* — the hook simply never runs. Register with `mcp__.*` first, run one search, read
the real `tool_name` out of the log, then tighten. `claude plugin validate . --strict` also
checks `hooks/hooks.json`.

The `PostToolUse` payload delivers `tool_name`, `tool_input`, `tool_response`, `tool_use_id`,
`session_id`, and `cwd` on stdin. **[verified 2026-08-11]** Look at a real `tool_response`
before writing the extractor rather than guessing its shape.

## B.4 Daemon

Binds `127.0.0.1` only. Port from `MANABASE_VIEWER_PORT`, default 7373.

| Endpoint | Behavior |
|---|---|
| `GET /healthz` | `204`. Lets the hook decide in ~1 ms whether to spawn. |
| `POST /cards` | `{ ids?, names?, mode?: "replace" \| "append", label? }`. Resolves, updates state, broadcasts. |
| `GET /events` | SSE. Emit the current set immediately on connect so a late front-end is not blank; comment heartbeat every 30s. |
| `GET /` | The browser page. |
| `GET /img/:id/:face/:size` | Cached bytes; fetch and cache on miss. |

**Resolution** goes through `POST /cards/collection`, **75 identifiers maximum per request**,
2 requests/second — the limit is per-endpoint and hard, per `docs/MCP-PRD.md` §3.4 and §4.1.2.
Reuse the server's existing Scryfall client rather than writing a second one: it already
carries the rate limiting, the 429 backoff, and the `User-Agent` and `Accept` headers §4.1
requires. A second unthrottled client in the same process is how an IP gets banned.

`collection` returns a `not_found` array. Log it; do not fail the request.

**Cache under `${CLAUDE_PLUGIN_DATA}`** (P-06), falling back to a platform user-cache directory
when unset, matching the rule PC-02 already establishes for the server. Card JSON for ≥24 hours
per Scryfall's stated guidance. Images to disk regardless of any rate limit — `chafa` re-renders
on every resize and keypress and must not hit the network to do it. The `*.scryfall.io` image
CDN has no rate limit **[verified 2026-08-11]**, so fetching is cheap; caching is for latency,
not politeness.

**The card projection sent over SSE must retain the link fields.** A naive implementation
projects to `{ id, name, image }` and silently makes §B.6 impossible. Keep at minimum: `id`,
`name`, `mana_cost`, `type_line`, `set`, `collector_number`, `scryfall_uri`, `related_uris`,
`purchase_uris`, and `card_faces` with per-face `name` and `image_uris`.

## B.5 Face extraction — the highest-value correctness detail

Scryfall's card object documentation states `image_uris` is nullable at the card level, and
that for double-sided cards it lives inside each `card_faces` element instead.
**[verified 2026-08-11]**

The trap: **split, flip, and adventure cards have a `card_faces` array but their images are on
the parent object** — both halves print on one physical card. Checking `card_faces` first
returns nothing for them. Correct order:

```ts
function faces(card) {
  if (card.image_uris) {
    return [{ name: card.name, uris: card.image_uris }];   // incl. split/flip/adventure
  }
  if (card.card_faces) {
    return card.card_faces
      .filter(f => f.image_uris)
      .map(f => ({ name: f.name, uris: f.image_uris }));   // transform / MDFC
  }
  return [];                                                // text placeholder
}
```

Test against one of each: normal, transform, MDFC, split, adventure. Get it backwards and half
the double-faced cards render as nothing, which looks like a network bug for an hour.

## B.6 Per-card links — data-driven, never hardcoded

Every card gets an affordance leading to its pages elsewhere. Today that is effectively just
Scryfall; it must become rulings, pricing, and whatever else without a UI rewrite. So build it
as data:

```ts
type CardLink = { label: string; href: string; kind: 'primary' | 'related' | 'purchase' };
function links(card): CardLink[]
```

Three sources, in order:

1. `card.scryfall_uri` → label `Scryfall`, kind `primary`. Always present, and it carries most
   of the "eventually" list on day one: the Scryfall card page already renders rulings,
   legality by format, printings, and Scryfall's own price.
2. `card.related_uris` — **iterate `Object.entries()`.**
3. `card.purchase_uris` — same iteration, gated.

**Why iteration.** Scryfall's documentation describes `related_uris` only as *"An object
providing URIs to this card's listing on other Magic: The Gathering online resources"* and
`purchase_uris` as *"An object providing URIs to this card's listing on major marketplaces.
Omitted if the card is unpurchaseable."* **[verified 2026-08-11]** **It does not enumerate the
keys.** Hardcoding a list observed once means new resources never appear and removed ones
render dead buttons. Iterating means new Scryfall keys arrive with no code change — which *is*
the extensibility requirement.

Label resolution: a small map for recognized keys, plus a humanizer fallback
(`some_new_resource` → `Some New Resource`). An unknown key gets a readable button, not a crash
and not a silent drop.

**UNVERIFIED: the actual keys in either object.** Enumerate them at runtime against real cards
and write the label map from what you find. Do not take a key list from memory or a blog post.

**Two traps.**

- **`rulings_uri` and `prints_search_uri` are API endpoints, not human pages.** Linking them
  opens raw JSON. "Links to rulings" naively maps to `rulings_uri` and produces a JSON dump. A
  real rulings view is a fetch-and-render feature reading `rulings_uri` server-side — a separate
  decision, not a hyperlink. Rulings are on the Scryfall card page meanwhile.
- **`purchase_uris` are marketplace links, and D-06 is nearby.** `docs/MCP-PRD.md` D-06 makes
  Scryfall the only price *source* — no TCGplayer API, no scraping, no paid provider — and §8
  rejects TCGplayer outright. A hyperlink is neither: it fetches nothing, integrates no
  provider, and reads no price. My reading is that it is consistent with D-06, but it is close
  enough that it must be deliberate rather than incidental. **Gate purchase links behind
  `MANABASE_VIEWER_PURCHASE_LINKS`, default off**, and record the reasoning in the PC block so
  a future session does not re-litigate it or quietly widen it into fetching.

**Placement.** In the grid, the link bar is hidden until hover, then fades in over the bottom
~12% of the card image — the collector-info strip, which is dead space. Primary link as a
labeled button; more than two collapse behind a `⋯`. A permanent button row under every tile
turns a wall of card art into a wall of chrome. In the lightbox, the complete labeled list is
always visible.

Every link is `target="_blank" rel="noopener noreferrer"`. The page is a persistent viewer on a
second monitor; navigating it away means hunting for it again.

## B.7 Browser front-end — `GET /`

One self-contained HTML page. No build step, no CDN, no framework — inline CSS and JS into a
template string. **This front-end has no dependencies beyond Node**, which is what keeps §3.4's
runtime rule intact.

Responsive grid of `large` (672×936) images, `border-radius: 4.75%`. Hover scales ~1.06 and
reveals the link bar. Click opens a lightbox at `png` (745×1040) with the full link list.
`EventSource('/events')` with backoff reconnect. Dark background — this stays open for hours.
The push `label` renders as a header so you can tell which result set you are looking at.

## B.8 Terminal front-end — optional, and it must say so

`chafa` is **not** a permitted prerequisite (§3.4). If it is absent, the terminal front-end
prints one line explaining that it is optional, how to install it, and that the browser page
works without it — then exits 0. It never blocks anything.

Render: clear, home, `chafa --clear --align center --size {cols}x{rows-3} {cachedPath}`, then
`{name} · {mana_cost} · {type_line}` and `{i+1}/{n}`. Let `chafa` auto-detect the format;
provide `MANABASE_VIEWER_CHAFA_FORMAT` as an override for when it guesses wrong.

Keys: `j`/`→`/space next, `k`/`←` previous, `f` flip face, `s` open this card's Scryfall page,
`o` open the browser page, `r` re-render, `q` quit. `s` exists so the pane has link parity with
§B.6 — otherwise reaching a card's listing means switching front-ends, which defeats the pane.

Re-render on `process.stdout.on('resize')`. Without it the image is garbage the moment the pane
is resized, which reads as broken.

Use `normal` (488×680). Larger is waste; `chafa` downsamples to cell resolution regardless.

**Do not chase readable oracle text.** At 60 columns the rules box is six to eight character
cells. It is illegible at every protocol and every image size. Art, frame, and color identity
read fine — that is the job. Oracle text comes from CAP-01 as text.

## B.9 Terminal support, for the README

Verified 2026-08-11. Relevant because the audience runs Windows, macOS, and Linux (§3.4).

| Terminal | Protocol | Note |
|---|---|---|
| Windows Terminal | Sixel | Since 1.22 (Preview, Aug 2024) |
| VS Code integrated | Sixel, iTerm2 | **Off by default** — needs `terminal.integrated.enableImages: true` |
| WezTerm, iTerm2 3.3+, xterm, mintty, foot, konsole 22.04+ | Sixel | |
| kitty, Ghostty | Kitty protocol | `chafa -f kitty` |
| Alacritty | none | Unicode blocks only |

Sixel under tmux is broken in Windows Terminal (`tmux/tmux` issue #4208). `chafa --passthrough`
is the flag elsewhere.

## B.10 Acceptance criteria

Written in the style PC-01 and PC-02 use — checkable statements, not aspirations. The PC block
from Part A is authoritative; these are the ones this file is confident about.

1. With the opt-in marker absent, running a search spawns no process, opens no socket, and
   writes nothing. The hook log records one skipped invocation.
2. With the marker present, running a search in a Claude Code session updates the browser page
   with no Bash tool call and no visible output in the transcript.
3. **Stopping the daemon and running another search leaves the session completely unaffected.**
4. `claude plugin validate . --strict` passes with `hooks/hooks.json` present.
5. The hook registration contains no shell metacharacters and uses `args` (§3.4 exec form).
6. No file is created or modified under `${CLAUDE_PLUGIN_ROOT}` during a session — PC-02
   criterion 6, which this component must not break.
7. After a `/plugin update`, the image cache from before the update is still present and still
   used (P-06).
8. A mixed batch — normal, transform, MDFC, split, adventure — renders every face correctly.
9. **Hand-edit a cached card JSON to add a fabricated `related_uris` key**, restart, and confirm
   a button appears with a humanized label. If it does not, the key list is hardcoded somewhere
   and §B.6 is not implemented.
10. With `MANABASE_VIEWER_PURCHASE_LINKS` unset, no marketplace link renders anywhere.
11. With `chafa` absent from `PATH`, the terminal front-end explains itself and exits 0; the
    browser page is unaffected.
12. Two searches issued back to back do not cause the process to exceed Scryfall's 2/second
    limit on `/cards/collection`, counting the server's own traffic.

## B.11 Out of scope

- Anything that puts image bytes into Claude's context (§A.2).
- **Fetching** from a marketplace. §B.6 permits outbound hyperlinks and nothing more.
- Rendering rulings, prices, or legality in the viewer. The links point at pages that already
  show them.
- A `bin/` executable, pending §A.7.
- Deck views and combo rendering. This shows cards.
- Any front-end beyond the two specified.
- Reimplementing the Scryfall client. Reuse the server's (§B.4).
