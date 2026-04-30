# Next Agent Handoff

Last updated: 2026-04-30T05:29:19.464Z
Updated by: codex

## Read First

- memory/CURRENT_STATE.md
- memory/INDEX.md
- memory/DECISIONS.md
- memory/handoffs/NEXT_AGENT.md
- AGENTS.md
- CLAUDE.md

## Current State

Biotech frontend now has both project-local memory and a link to universal memory at C:\Users\itsup\agent-memory. Agents should read universal memory first, then this repo's memory.

## Details

Updated AGENTS.md, CLAUDE.md, docs/memory-system.md, docs/universal-memory.md, memory/CURRENT_STATE.md, and .mcp.json. Universal memory is a separate local Git repo on main and includes its own MCP server and CLI.

## Next Actions

- Commit this repo's memory and app changes.
- Commit C:\Users\itsup\agent-memory separately and connect it to a private GitHub remote.
- Use universal memory for reusable lessons across future projects.

## Guardrails

- Do not commit local agent settings or secrets.
- Keep memory updates in Git with related code changes.
- Run npm run memory:index after manual memory edits.
