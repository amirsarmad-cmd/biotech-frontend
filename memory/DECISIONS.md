# Decisions

This file is the human-readable decision index. Detailed records live in `memory/decisions/`.

## Accepted

- 2026-04-30: [Git-backed memory is the source of truth](decisions/2026-04-30T00-00-43-774Z-git-backed-memory-is-the-source-of-truth.md) - Project memory lives in Git and Railway serves it read-only.
- 2026-04-30: [Use local MCP for agent continuity](decisions/2026-04-30T00-00-54-720Z-use-local-mcp-for-agent-continuity.md) - A stdio MCP server exposes memory read, search, append, and handoff tools.
- 2026-04-30: [Keep agent secrets out of Git](decisions/2026-04-30T00-01-07-134Z-keep-agent-secrets-out-of-git.md) - Local Claude settings and environment files are ignored.
