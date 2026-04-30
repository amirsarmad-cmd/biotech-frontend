# Universal Memory Layer

Date: 2026-04-30
Status: active

## Summary

The Biotech Screener project is now linked to a universal cross-project memory at `C:\Users\itsup\agent-memory`.

## Design

- Universal memory stores cross-project operating principles, design taste, Railway/Git conventions, and the project registry.
- Project memory stores Biotech Screener-specific sessions, decisions, designs, and handoffs.
- `.mcp.json` exposes both universal and project memory servers.
- Agents read universal memory first, then project memory.

## Outcome

Future agents can learn both how this specific app works and how all projects should be built.

