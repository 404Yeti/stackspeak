# StackSpeak

**Read it. Explain it. Fix it. Defend it.**

StackSpeak is a voice-first coding comprehension and technical English learning platform. Students read unfamiliar code, explain it aloud, identify and fix problems, run their solution, and defend their engineering decisions — building independent engineering judgment rather than reflexively accepting AI-generated answers.

Core learning sequence: **READ → EXPLAIN → FIX → RUN → DEFEND → FEEDBACK**

## Repository layout

```
stackspeak/
├── frontend/   Next.js + TypeScript + Tailwind
├── backend/    FastAPI + Pydantic
└── docs/       architecture, design system, development guide, decisions, sprint notes
```

## Quick start

See [`docs/development.md`](./docs/development.md) for full setup. Short version:

```bash
# Backend
cd backend && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/uvicorn app.main:app --reload   # http://localhost:8000

# Frontend (separate terminal)
cd frontend && npm install
npm run dev                                # http://localhost:3000
```

## Documentation

- [`AGENTS.md`](./AGENTS.md) — persistent instructions for AI coding agents (architecture, conventions, Linear/Figma workflow, current project state)
- [`CLAUDE.md`](./CLAUDE.md) — Claude Code–specific pointer into `AGENTS.md`
- [`docs/architecture.md`](./docs/architecture.md) — system boundaries, technology choices, security boundary
- [`docs/design-system.md`](./docs/design-system.md) — Figma source of truth, design tokens, component conventions
- [`docs/development.md`](./docs/development.md) — local setup, commands, troubleshooting
- [`docs/decisions/`](./docs/decisions/) — architectural decision records
- [`docs/sprints/`](./docs/sprints/) — per-sprint implementation and verification summaries

## Status

Sprint 01 — Application Foundation. See [`docs/sprints/sprint-01.md`](./docs/sprints/sprint-01.md) for what's implemented and what's deliberately deferred.
