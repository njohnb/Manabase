---
description: Reconcile the binding documents after a slice or plan completes.
---

Launch the `doc-sync` subagent (`.claude/agents/doc-sync.md`) for: $ARGUMENTS

Hand it the slice or plan identifier, the commits or PRs, which acceptance criteria are now verified
and with what evidence, and any open question the work resolved.

If no slice or plan is named above, infer what changed from `git log` since the last `docs:` commit
and **state that inference before proceeding** — do not let the subagent guess.

This command is the manual re-run path. The trigger is `CLAUDE.md`'s `## Closing out a slice` rule,
not this file. Review the subagent's diff before committing anything it wrote.
