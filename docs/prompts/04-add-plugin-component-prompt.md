# MTG Claude Plugin — Add Component Session

Reusable. Paste one or more component requests into the slot below and run.

---

**Read `docs/PLUGIN-PRD.md` in full before doing anything else.** It is the source of truth
for the plugin. This conversation is not — everything you need is in the document, and
anything you decide here that matters must end up back in it.

**Also read `docs/MCP-PRD.md` §2 and §3.** The plugin inherits the MCP server's locked decisions
and constraints. A component that violates one of them is out of bounds even if
`docs/PLUGIN-PRD.md` says nothing about it.

**Do not write implementation code.** Your output is an edit to `docs/PLUGIN-PRD.md`.

## What to do

1. **Read both documents.** `docs/PLUGIN-PRD.md` in full; `docs/MCP-PRD.md` §2 and §3, plus any
   CAP block the request touches.
2. **Check the request against them.** If a component conflicts with a locked decision or a
   constraint in either document, stop and tell me before writing anything. Don't quietly
   design around it and don't re-open the decision — surface the conflict and let me choose.
3. **Apply the PC-or-CAP test.** If the component needs the MCP server to do something it
   does not already do, that work is a CAP in `docs/MCP-PRD.md`, not a PC here. Say so and stop.
   A skill cannot compensate for a tool that doesn't exist, and specifying one as if it could
   produces a component that can't be built. This is the most common way this document gets
   corrupted.
4. **Research only what's new.** If the component relies on a harness feature already in §4,
   use what's recorded there. If it introduces a new one, research it against live docs and
   add a subsection with the date verified. Re-verify an existing entry only if it's stale
   enough to matter or the component depends on a detail the entry doesn't cover.
5. **Budget the context cost honestly.** Fill in the `Context cost` field with a real estimate
   and say what it's based on. If the always-on cost is hard to justify against the value,
   say that instead of writing a number that flatters the component. Merging into an existing
   PC is a legitimate outcome of this step.
6. **Ask questions before writing**, batched. A component specified from guesswork is worse
   than one that took an extra round trip.
7. **Write the PC block(s)** using the template at the top of section 5, verbatim. Next
   available ID, never reused.
8. **Update sections 6, 7, and 9.** Phase assignment with reasoning, any new open questions,
   a revision log line. If the new component changes the phasing of existing ones, say so
   explicitly rather than silently rewriting section 6.
9. **Report what changed** — which sections, and anything you couldn't resolve.

## What not to touch

Sections 1, 2, 3, and 8 stay as they are unless the component genuinely forces a change — in
which case raise it with me first rather than editing. If you find yourself wanting to revise
a locked decision to make a component fit, that's a signal the component needs rethinking, or
that I need to reopen the decision deliberately.

**Never edit `docs/MCP-PRD.md` from this session.** If the work belongs there, tell me and I'll
run the capability prompt against it.

Existing PC blocks stay as they are unless the new component creates a real dependency, in
which case update only the `Depends on` line of the affected block.

## Component request

<!-- PASTE ONE OR MORE COMPONENT DESCRIPTIONS HERE -->

---

# Appendix — queued components

Copy into the slot above. **One or two per session.** Running the whole queue at once
produces shallow specs, which is the thing this format exists to prevent. Skills are cheaper
to specify than agents or hooks; two skills in a session is reasonable, one agent is not.

The roadmap beyond these two is deliberately open. When it's time to fill it in, that's its
own session with the roadmap in front of us — not something to improvise while specifying a
component.

### Deck-analysis skill
*Specify before deck-optimize. May be groupable with it if both stay tight.*

The instructions that let Claude look at a decklist and say something useful about it —
curve, color sources, counts of ramp and interaction and card draw, legality for the format,
where the money is concentrated. Not a report generator; the point is that Claude reaches
sensible conclusions without me prompting for each dimension.

Three things to resolve rather than hand-wave:

- **The tool dependency is probably not satisfied yet.** This needs deck reading and
  decklist pricing, both of which are queued but unspecified in `docs/MCP-PRD.md`. Apply the
  PC-or-CAP test honestly. If the CAPs aren't there, the right output of this session may be
  a PC block with `Status: proposed` and a blocking open question in §7, not a specified one.
- **Analysis is judgment, not lookup.** Acceptance criteria have to be checkable statements
  about what Claude does — the failure mode is criteria like "provides useful analysis."
- **It must not carry card data.** A skill that lists what counts as a ramp spell is a
  hallucination source that goes stale. Route to the tools.

### Deck-optimize skill
*Depends on deck-analysis. Specify second.*

Proposes changes to a deck. The hard part is that "better" is undefined without a goal —
budget ceiling, power level, a specific commander's plan, a local meta — so the skill's real
job may be eliciting the goal before proposing anything. Don't paper over that.

Constraints it must respect:

- **It cannot write to Archidekt.** `docs/MCP-PRD.md` §2 lands writes last. The output is a
  proposed list I move myself, per the queued Arena-format export capability. Check whether
  that capability is specified yet; if not, that's a dependency, not a detail.
- **It leans on combo and budget-alternative capabilities** that are queued and unspecified
  in `docs/MCP-PRD.md`. Same test as above.
- **Two always-on skill descriptions is a real cost.** Justify why this is separate from
  deck-analysis rather than one skill with two modes. "They're conceptually different" is not
  a justification; a difference in when Claude should invoke them is.
