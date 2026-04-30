---
type: "decision"
title: "Use local MCP for agent continuity"
date: "2026-04-30T00:00:54.720Z"
agent: "codex"
tags: ""
---

# Use local MCP for agent continuity

Date: 2026-04-30T00:00:54.720Z
Agent: codex
Type: decision

## Summary

A stdio MCP server exposes memory read, search, append, and handoff tools.

## Details

The MCP server is local development plumbing for Codex, Claude Code, and other compatible agents. It keeps write access close to the working tree and avoids adding deployment credentials to the frontend runtime.

## Next

- Load .mcp.json in MCP-capable agents.
