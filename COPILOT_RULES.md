# Copilot Working Rules

Owner directive: The root-level `data/` directory is the single source of truth for incident data.

Effective immediately:

- Do not modify, move, rename, or delete any files in `data/` without explicit written permission from the owner.
- Treat `data/` as read-only. Allowed operations: read and parse only.
- Write all derived or processed artifacts to non-source locations (e.g., `public/data/`, `scripts/output/`, or temporary working memory/files), never back into `data/`.
- If a task requires altering source data (cleaning, normalization, reformatting), pause and request explicit approval before proceeding.
- When running terminal commands, avoid any destructive operations targeting `data/` (e.g., `rm`, `mv`, `sed -i`, `jq` updates).

Scope:
- This policy applies to all agents, scripts, and tooling used within this workspace.
- The policy persists across sessions until the owner revokes or amends it.

Acknowledgement:
- GitHub Copilot will adhere to this rule and will not modify the `data/` folder without permission.
