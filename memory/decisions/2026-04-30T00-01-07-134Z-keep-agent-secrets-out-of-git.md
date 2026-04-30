---
type: "decision"
title: "Keep agent secrets out of Git"
date: "2026-04-30T00:01:07.134Z"
agent: "codex"
tags: ""
---

# Keep agent secrets out of Git

Date: 2026-04-30T00:01:07.134Z
Agent: codex
Type: decision

## Summary

Local Claude settings and environment files are ignored.

## Details

Local agent settings can include Railway tokens or other credentials. The repo ignores .claude/settings.local.json, .claude lock files, .env, and .env.* so the memory archive can be committed safely.

## Next

- Rotate any exposed token if it has ever been pushed or shared outside the local machine.
