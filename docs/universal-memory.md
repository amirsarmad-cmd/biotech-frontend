# Universal Memory

The universal memory root is:

```text
C:\Users\itsup\agent-memory
```

This is the cross-project layer. It teaches agents how work should happen across every app, while this repo's `memory/` directory records the Biotech Screener-specific history.

## Agent Startup

Agents should read universal memory first:

1. `C:\Users\itsup\agent-memory\GLOBAL_CONTEXT.md`
2. `C:\Users\itsup\agent-memory\OPERATING_SYSTEM.md`
3. `C:\Users\itsup\agent-memory\AGENTS_GLOBAL.md`
4. `C:\Users\itsup\agent-memory\PROJECTS.md`

Then read this repo:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `memory/CURRENT_STATE.md`
4. `memory/INDEX.md`
5. `memory/handoffs/NEXT_AGENT.md`

## MCP

This repo's `.mcp.json` exposes both:

- `universal-memory`
- `project-memory`

Use universal MCP tools for reusable lessons and project registry updates. Use project MCP tools for Biotech Screener implementation history.

## Rule Of Thumb

If the record would help every future project, write it to universal memory.

If the record only explains this app, write it to project memory.

