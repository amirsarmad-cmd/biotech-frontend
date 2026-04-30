# Project Memory System

This repo now has a memory system designed for Codex, Claude Code, and future agents to continue work without losing context. It is also wired to the universal cross-project memory at `C:\Users\itsup\agent-memory`.

## Goals

- Keep a durable project archive in Git.
- Learn from the universal cross-project archive before reading project-specific history.
- Make agent handoffs explicit and repeatable.
- Record sessions, decisions, designs, and next actions.
- Provide a local MCP server so agents can read and write memory through tools.
- Surface the archive on Railway at `/memory`.

## Layers

1. Universal archive: `C:\Users\itsup\agent-memory` stores cross-project habits, playbooks, and reusable lessons.
2. Git archive: `memory/` is the project-local canonical history.
3. Agent boot files: `AGENTS.md` and `CLAUDE.md` tell every agent where to start.
4. Capture CLI: `scripts/memory.mjs` creates session, decision, design, and handoff records.
5. MCP servers: universal and project servers expose memory tools over stdio.
6. Railway viewer: the Next route `/memory` reads the checked-in project archive.

## Daily Workflow

Start:

```bash
cd C:\Users\itsup\agent-memory
npm run memory:status

cd C:\Users\itsup\biotech-frontend
npm run memory:status
```

Record a work session:

```bash
npm run memory:session -- --agent codex --title "Build watchlist filters" --summary "Added saved filters and empty states"
```

Record a decision:

```bash
npm run memory:decision -- --title "Use Git-backed memory" --summary "Git is the source of truth" --body "Railway hosts the readable archive, but agents write locally and commit."
```

Update the next-agent handoff:

```bash
npm run memory:handoff -- --agent codex --summary "Weights page refactor is halfway done" --next "Finish validation states"
```

Rebuild the index:

```bash
npm run memory:index
```

## MCP Setup

The project includes `.mcp.json` with both memory servers:

```json
{
  "mcpServers": {
    "universal-memory": {
      "command": "node",
      "args": ["C:/Users/itsup/agent-memory/mcp/universal-memory-server.mjs"]
    },
    "project-memory": {
      "command": "node",
      "args": ["mcp/project-memory-server.mjs"]
    }
  }
}
```

Agents that support project MCP configuration can load it directly. Otherwise, add a server manually with command `node` and args `mcp/project-memory-server.mjs` from the repo root.

## Railway Hosting

The memory archive is committed to Git and copied into the Docker runtime image. Railway deploys the app and serves the archive at:

```text
/memory
```

The deployed app should not be treated as the write path for memory. Container file changes are not a durable archive. If automatic remote capture is needed later, add a Railway Postgres table plus a GitHub sync worker.

## Secret Hygiene

Do not put tokens, credentials, private keys, or local agent settings in memory. The repo ignores `.env`, `.env.*`, `.claude/settings.local.json`, and `.claude/*.lock`.
