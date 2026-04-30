# Claude Code Notes

Claude Code should follow `AGENTS.md` as the source of shared agent behavior.

## Startup

Read these files before changing code:

1. `C:\Users\itsup\agent-memory\GLOBAL_CONTEXT.md`
2. `C:\Users\itsup\agent-memory\OPERATING_SYSTEM.md`
3. `C:\Users\itsup\agent-memory\AGENTS_GLOBAL.md`
4. `C:\Users\itsup\agent-memory\PROJECTS.md`
5. `AGENTS.md`
6. `memory/CURRENT_STATE.md`
7. `memory/INDEX.md`
8. `memory/handoffs/NEXT_AGENT.md`

## MCP

This repo includes MCP servers for universal and project memory:

```bash
npm run memory:mcp
cd C:\Users\itsup\agent-memory && npm run mcp
```

The project-level `.mcp.json` points to both `C:/Users/itsup/agent-memory/mcp/universal-memory-server.mjs` and `mcp/project-memory-server.mjs`. Use universal memory for cross-project learning and project memory for repo-local history.

## End Of Work

Before handing off:

```bash
npm run memory:session -- --agent claude --title "Short title" --summary "What changed"
npm run memory:handoff -- --agent claude --summary "Current state" --next "Best next action"
npm run memory:index
```

Keep local Claude settings private. Do not commit `.claude/settings.local.json` or lock files.
