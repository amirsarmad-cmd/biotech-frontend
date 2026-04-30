# Project Memory MCP

This MCP server lets agents read, search, and write the repo memory archive.

Run it from the repo root:

```bash
npm run memory:mcp
```

Available tools:

- `memory_status`: show archive counts and git state.
- `memory_read`: read a file under `memory/`.
- `memory_search`: search markdown records.
- `memory_append`: create session, decision, design, or note records.
- `memory_handoff`: update `memory/handoffs/NEXT_AGENT.md`.

The server uses stdio because it is intended for local agents. Railway hosts the resulting archive through the app at `/memory`.

