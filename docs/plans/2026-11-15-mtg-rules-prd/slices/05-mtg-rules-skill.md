# 05: The `mtg-rules` skill — PC-05 spec and skill

**What to build:** when a user asks a rules or interaction question, Claude looks it up and cites
it. CR claims carry a rule number, the CR version and the PDF link. Rulings carry their date and
whether they are an official Wizards ruling or a Scryfall note. Interaction questions combine both
cards' rulings with the relevant rules. Nothing is answered from memory, and if the tools are
missing Claude says so. The combo and deck skills send "does this actually work?" questions here.

**Blocked by:** 01, 03.

**Status:** ready-for-agent

- [ ] A PC-05 block is appended to [PLUGIN-PRD §5](../../../PLUGIN-PRD.md#5-components) under its
      template, and §6, §7 and §9 are updated.
- [ ] The skill holds instructions only and no rules text or card facts, per
      [PLUGIN-PRD §3.6](../../../PLUGIN-PRD.md#36-skills-carry-instructions-never-facts).
- [ ] It names no scoped tool string, per
      [P-12](../../../PLUGIN-PRD.md#p-12--plugin-name-and-server-key), and has no links outside
      its own directory.
- [ ] Its frontmatter values containing a colon-space are quoted, and the frontmatter test in
      `npm test` passes.
- [ ] It teaches the no-fallback rule explicitly: a missing tool is reported, never replaced by
      web search or memory.
- [ ] The combo and deck skills each gain a pointer to it by name. They do not automatically
      re-check Commander Spellbook results.
- [ ] The skill is confirmed **loaded** in a real session's skill listing, not by the
      `/reload-plugins` count.
- [ ] The description's context cost is measured against the plugin's listing budget and recorded.
- [ ] `doc-sync` is dispatched as the closeout.
