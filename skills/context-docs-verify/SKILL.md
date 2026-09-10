---
name: context-docs-verify
description: |
  Verify and repair context-docs health. Checks for stale docs, missing scoped references,
  manifest issues, backwards compatibility gaps, and package freshness.
user-invocable: true
---

# /context-docs-verify — Context Docs Health Check

## Overview

Run a health check on the `.ai-context-docs/` directory in the current project. Identifies issues, reports them, and offers to fix each one.

## Process

Run all checks below, then present a summary report. For each issue found, offer to fix it.

### Check 1: Stale Docs Not Rebuilt

1. Read `.ai-context-docs/.stale` — if it exists and has entries, docs are out of date
2. Compare the `.db` package timestamp against `tracking.lastFullBuild` in the manifest — if source files changed after the last build, the package is stale
3. **Fix:** Offer to spawn the context-updater agent to process stale topics and rebuild the package

### Check 2: Missing `_untracked` Catch-All Globs

1. Read `.ai-context-docs/context.json` — check if `tracking.coverage._untracked` exists
2. Also check all scoped manifests under `.ai-context-docs/scoped/*/context.json`
3. **Fix:** Generate `_untracked` globs by looking at parent directories of existing coverage entries and creating wildcard patterns that catch new siblings

### Check 3: Missing Scoped Package References

1. List all scoped packages under `.ai-context-docs/scoped/`
2. Check if `.ai-context-docs/docs/_scoped-packages.md` exists and contains an entry for each scoped package
3. **Fix:** Create or update `_scoped-packages.md` with missing entries, then rebuild the main package

### Check 4: Scoped Paths Not Excluded from Main

1. For each scoped package, read its `scope` field from the manifest
2. Check if that path appears in the main manifest's `focus.exclude` list
3. Also check if the main manifest's `tracking.coverage` still contains globs overlapping with the scoped path
4. **Fix:** Add scoped paths to main manifest's exclude list and remove overlapping coverage entries

### Check 5: Manifest Schema Backwards Compatibility

1. Check each manifest (main + scoped) for missing fields that were added in later versions:
   - `scope` field (added v1.3.0) — should be `null` for main, path string for scoped
   - `tracking.coverage._untracked` (added v1.4.0) — should exist
   - `conventions.agentGotchas` (should be an array, not missing)
   - `tracking.lastFullBuild` (should not be null after first build)
2. **Fix:** Add missing fields with sensible defaults

### Check 6: Orphaned Docs

1. For each doc file in `.ai-context-docs/docs/`, check if a corresponding coverage entry exists in the manifest
2. Flag any docs that aren't covered by any topic — they may have been left behind after a scoped extraction
3. **Fix:** Offer to delete orphaned docs or create coverage entries for them

### Check 7: Package Freshness

1. Compare the `.db` file modification time against the newest `.md` file in the docs directory
2. If any docs are newer than the package, the package needs rebuilding
3. **Fix:** Rebuild the package with `context add`

### Check 8: CLAUDE.md Integration

1. Check if `CLAUDE.md` contains the Context Docs section
2. Check if all packages (main + scoped) are listed in the CLAUDE.md instructions
3. **Fix:** Add or update the Context Docs section

### Check 9: Sensitive File Exposure

1. Scan all doc files for references to sensitive file patterns: `appsettings*.json`, `*.secrets.json`, `.env`, `web.config`, `launchSettings.json`
2. Flag any docs that contain content sourced from sensitive files
3. **Fix:** Remove the sensitive content and regenerate the affected doc from non-sensitive sources

## Report Format

Present results as a checklist:

```
## Context Docs Health Report

- [x] Stale docs — clean
- [ ] Missing _untracked globs — FOUND in main manifest
- [x] Scoped package references — all present
- [ ] Scoped exclusions — "src/MyPackage" not excluded from main
- [x] Manifest schema — up to date
- [x] Orphaned docs — none
- [ ] Package freshness — main package is 3 days behind docs
- [x] CLAUDE.md integration — present
- [x] Sensitive file exposure — clean

### Issues (3 found)
1. **Missing _untracked globs** in main manifest — [Fix now?]
2. **Scoped exclusion missing** — `src/MyPackage` not in main exclude list — [Fix now?]
3. **Package stale** — main .db is older than docs — [Rebuild now?]
```

After presenting the report, ask: "Want me to fix all issues, or select specific ones?"

## Important

- This skill is read-only by default — it only makes changes when the user approves fixes
- Always present the full report before offering fixes
- When fixing, process in order: manifest fixes first, then doc fixes, then package rebuild last
