# Agent Operating Guide

This file is the shared boot sequence for Codex, Claude Code, and any other agent working on this repo.

## Universal First

Read the cross-project memory before local project files:

1. `C:\Users\itsup\agent-memory\GLOBAL_CONTEXT.md`
2. `C:\Users\itsup\agent-memory\OPERATING_SYSTEM.md`
3. `C:\Users\itsup\agent-memory\AGENTS_GLOBAL.md`
4. `C:\Users\itsup\agent-memory\PROJECTS.md`

Use universal memory for reusable lessons, cross-project conventions, and project registry updates.

## Project First Read

1. `README.md` for app purpose and deployment basics.
2. `memory/CURRENT_STATE.md` for the live project picture.
3. `memory/INDEX.md` for recent sessions, decisions, designs, and handoffs.
4. `memory/handoffs/NEXT_AGENT.md` before continuing unfinished work.
5. `git status --short --branch` before editing.

## Memory Protocol

- Treat `C:\Users\itsup\agent-memory` as the universal cross-project archive.
- Treat `memory/` as the project archive and continuity layer.
- Record meaningful work with `npm run memory:session -- --agent <agent> --title "<title>" --summary "<summary>"`.
- Record architectural decisions with `npm run memory:decision -- --title "<title>" --summary "<summary>" --body "<why>"`.
- Record UI/product designs with `npm run memory:design -- --title "<title>" --summary "<summary>" --body "<details>"`.
- Update the handoff with `npm run memory:handoff -- --agent <agent> --summary "<where things stand>" --next "<next action>"`.
- Run `npm run memory:index` after manual memory edits.
- Commit memory updates with related code changes so Git remains the durable archive.
- Record universal memory only when the lesson should apply to future projects too.

## Safety Rules

- Never commit secrets, tokens, local credentials, `.env`, or `.claude/settings.local.json`.
- If an agent discovers a secret in local files, protect it and mention only that a secret was found, not its value.
- Do not overwrite another agent's or user's uncommitted changes.
- Prefer small, traceable changes and explain tradeoffs in memory when decisions matter.

## Product Context

Biotech Screener is a Next.js 15 frontend for FDA catalyst-driven biotech stock analysis. It presents catalyst timing, probability, NPV, analyst, social, news, dilution, and risk views over a Railway-hosted backend API.

## Railway And Git

- Railway deploys from the Git repo.
- `memory/` is included in the production image so `/memory` can show the current archive.
- Runtime writes from Railway are not the source of truth. Agents should write memory locally, then commit and push.
