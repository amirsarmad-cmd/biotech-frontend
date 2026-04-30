# Memory System Design

Date: 2026-04-30
Status: active

## Problem

The project started in a chat interface and is moving into code agents. Without a shared archive, agents can forget intent, repeat work, or drift away from the product direction.

## Design

The memory system uses Git as the durable archive and Railway as the hosted reader.

- Agents start from `AGENTS.md`, `CLAUDE.md`, `memory/CURRENT_STATE.md`, and `memory/INDEX.md`.
- Agents record work through `scripts/memory.mjs` or the MCP tools.
- `memory/handoffs/NEXT_AGENT.md` keeps the next step explicit.
- `/memory` renders the archive inside the app after Railway deploys from Git.

## Write Path

Agents write memory locally, then commit and push it with code. This creates an auditable project history and avoids relying on ephemeral container writes.

## Future Upgrade

If fully automatic remote capture becomes necessary, add a separate Railway memory service with Postgres tables for events, designs, and chats, then mirror approved records back to Git through a GitHub app or action.

