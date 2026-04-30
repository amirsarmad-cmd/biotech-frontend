---
type: "decision"
title: "Git-backed memory is the source of truth"
date: "2026-04-30T00:00:43.774Z"
agent: "codex"
tags: ""
---

# Git-backed memory is the source of truth

Date: 2026-04-30T00:00:43.774Z
Agent: codex
Type: decision

## Summary

Project memory lives in Git and Railway serves it read-only.

## Details

Agents write memory locally, then commit it with related code changes. Railway hosts the checked-in archive at /memory, but deployed containers are not treated as durable writers.

## Next

- Add Postgres plus GitHub sync later if remote automatic capture is required.
