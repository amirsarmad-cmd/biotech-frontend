---
type: "note"
title: "Imported Claude normalize pipeline state"
date: "2026-04-30T05:42:54.233Z"
agent: "codex"
tags: ""
---

# Imported Claude normalize pipeline state

Date: 2026-04-30T05:42:54.233Z
Agent: codex
Type: note

## Summary

Imported Claude-local memory about the Biotech V2 EDGAR normalize and post-catalyst backfill pipeline.

## Details

Claude memory recorded that normalize-all was running on 2026-04-30 against EDGAR staging rows, with follow-up Tasks 3 and 4 pending after normalize completes. Key API base: https://biotech-api-production-7ec4.up.railway.app. Key status endpoint: GET /admin/post-catalyst/normalize-all-status. Follow-up endpoints: POST /admin/post-catalyst/backfill?limit=500, POST /admin/post-catalyst/backfill-runup-and-classify-v2?limit=500, POST /admin/post-catalyst/backfill-sector-runup-and-reclassify?limit=500, POST /admin/post-catalyst/label-outcomes-batch?max_rows=50&only_new=true. Railway context noted by Claude: project capable-radiance, biotech-api service, use C:\Users\itsup\biotech-api as the linked Railway directory. No secrets were imported.

## Next

- Check normalize status before continuing backend pipeline work.
- Keep Claude-local memory and repo memory synchronized when new work is discovered.
