# Current State

Last updated: 2026-04-30

## Product

Biotech Screener is a dark terminal-style Next.js frontend for FDA catalyst stock screening. It helps compare long and short biotech setups using catalyst timing, probability, NPV, news, analyst, social, dilution, source precedence, and risk panels.

## Frontend

- Framework: Next.js 15 App Router, React 19, TypeScript.
- Styling: Tailwind with a custom dark palette.
- Data fetching: TanStack Query.
- Deployment: Dockerfile plus `railway.toml`.
- Production API default: `https://biotech-api-production-7ec4.up.railway.app`.

## Memory System

- Universal memory lives at `C:\Users\itsup\agent-memory` and stores cross-project operating principles, project registry, reusable design direction, and playbooks.
- `AGENTS.md` is the shared boot guide for all agents.
- `CLAUDE.md` gives Claude Code-specific startup and handoff notes.
- `memory/` is the Git-backed archive.
- `scripts/memory.mjs` records sessions, decisions, designs, and handoffs.
- `mcp/project-memory-server.mjs` exposes memory tools to MCP-capable agents.
- `/memory` shows the checked-in archive when deployed on Railway.

## Important Guardrail

Local Claude settings in `.claude/` can contain secrets. They are intentionally ignored and should not be committed.

## Next Intent

Keep building the screener while recording every meaningful architecture decision, UI design direction, deployment change, and agent handoff in this archive. Record universal memory only when a lesson or decision should teach future projects too.
