# CLAUDE.md

This file gives Claude Code project-specific instructions. Full project context, architecture, and conventions live in [`AGENTS.md`](./AGENTS.md) — read it first, every session.

## Before writing code

- Re-read `AGENTS.md` if it's been more than a few turns since you last did.
- Check the current Linear issue (project: https://linear.app/failed-training/project/stackspeak-mvp-30a1afc07d6f) for scope and acceptance criteria before implementing. Don't expand scope beyond the issue without asking.
- For any UI work, pull the relevant Figma screen/component via the Figma MCP tools before writing markup — see `AGENTS.md` §4 for what's actually accessible in the file today.

## While working

- Follow the architecture and security boundaries in `AGENTS.md` and `docs/architecture.md` — in particular, never execute untrusted student code on the host, and never put secrets in frontend-reachable code.
- Keep changes small and incremental. Update `docs/` (architecture, design-system, development, sprints, decisions) when you make a decision or change worth remembering next session.

## Before claiming done

- Run the real verification commands (lint, typecheck, tests, build — see `AGENTS.md` §2) and report actual results, not assumptions.
- Ask for approval before merging a PR, deploying anything, or starting work beyond the current approved issue.
