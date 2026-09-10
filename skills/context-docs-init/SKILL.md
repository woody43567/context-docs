---
name: context-docs-init
description: |
  Analyze a .NET project and generate AI-optimized context documentation for the context CLI.
  Discovers entities, repositories, patterns, and conventions, then generates searchable docs.
  Supports scoped mode: pass a subfolder path to generate a separate package for just that area.
user-invocable: true
---

# /context-docs-init — Generate AI-Optimized Context Documentation

## Overview

Analyze a .NET project and generate AI-optimized markdown documentation for serving via the context CLI. The documentation focuses on patterns, conventions, and real code examples that help AI agents correctly implement against the project's APIs.

## Modes

This skill operates in two modes:

### Full mode (default)
```
/context-docs-init
```
Analyzes the entire project. Generates docs in `.ai-context-docs/docs/` with a manifest at `.ai-context-docs/context.json`.

### Scoped mode
```
/context-docs-init src/MyPackage
/context-docs-init src/MBS.ImageStudio.*
```
Analyzes only the specified path(s). Generates docs in `.ai-context-docs/scoped/<package-name>/docs/` with a separate manifest at `.ai-context-docs/scoped/<package-name>/context.json`. The scoped path is automatically added to the main manifest's exclude list (if one exists) to avoid duplication.

**Wildcard support:** The path argument supports glob patterns (e.g., `src/MBS.ImageStudio.*`). When a wildcard is provided:
1. Expand the glob to find all matching directories
2. Present the matched directories to the user for confirmation: "I found these directories matching `src/MBS.ImageStudio.*`: [list]. Include all of them?"
3. Treat all matched directories as a single scoped package — analyze them together, generate unified docs
4. Store the original glob pattern in the manifest's `scope` field
5. Use the glob pattern (not individual paths) in coverage entries and the main manifest's exclude list

**Determine the mode from the arguments.** If a path argument is provided, use scoped mode. Otherwise, use full mode.

## Process

### Phase 1: Project Discovery

1. **Full mode:** Ask the user which project path to analyze (default: current working directory)
   **Scoped mode:** Use the provided path argument. Suggest a package name by checking (in order of preference):
     1. NuGet package name — look for a `.csproj` in the scoped path and check for `<PackageId>` or `<AssemblyName>`
     2. Root namespace — check for `<RootNamespace>` in the `.csproj`
     3. Assembly name — the `.csproj` filename without extension
     4. Directory name — last segment of the scoped path, lowercased and hyphenated
   Confirm with the user: "I'll analyze `<path>` as a scoped package. Based on the project, I'd suggest naming it `<suggested-name>`. Does that work?"
2. Scan the project (or scoped path) to discover:
   - Project/solution structure (`.sln`, `.slnx`, `.csproj`, `package.json`, `pyproject.toml`, etc.)
   - **Domain model / entities** — data classes, models, DTOs, database entities
   - **Data access layer** — repositories, data services, ORM patterns, query builders, database context classes
   - **Filtering / querying patterns** — filter objects, query handlers, specifications, search patterns
   - **Dependency injection / service registration** — how services are wired up
   - **Base classes and class hierarchies** — abstract classes, interfaces, inheritance chains
   - **Domain directories** — how the codebase is organized by business domain or feature
   - **Mapping / serialization** — column mappers, automapper profiles, serialization config
   - **Extension methods** — key extension methods that add behaviour to core types, utility extensions, builder extensions (agents often can't resolve these)
   - **Conventions** — naming patterns, namespace organization, file structure patterns
3. Present a structured summary of findings:
   - Number of entities, services, data access classes found
   - Detected domains (by directory structure)
   - Detected patterns and class hierarchies
   - Any conventions noticed (naming, namespace, file organization, etc.)

### Phase 2: Clarifying Questions

Ask the following questions **one at a time**. Prefer multiple choice where possible.

1. **Domain priority:** "I found these domains: [list]. Which are most important for agents to understand?"
   - Present as a multi-select checklist with recommended priorities based on complexity
2. **Secondary granularity:** "For the domain subfolders, should I document:"
   - A) Per-class — individual docs for each entity/repository (detailed, surgical updates)
   - B) Per-domain — one overview per domain (concise, less maintenance)
   - C) Mixed — per-class for high-priority domains, per-domain for the rest (recommended)
3. **Agent pain points:** "Are there patterns or areas where agents consistently get things wrong?" (free text)
4. **Exclusions:** "Any directories or areas to exclude from documentation?" (default: Tests/**, obj/**, bin/**)
   - **Always exclude** (even if user doesn't mention them):
     - **Secrets/config:** `appsettings*.json`, `*.secrets.json`, `.env`, `.env.*`, `**/secrets/**`, `**/credentials/**`, `web.config`, `launchSettings.json`, `*.pfx`, `*.pem`, `*.key`, `*.cert`
     - **Planning/dev files:** `docs/plans/**`, `.planning/**`, `**/PLAN.md`, `**/ROADMAP.md`, `**/TODO.md`, `.ai-context-docs/**`, `.graphene/**`, `CLAUDE.md`
     - **Prompts/AI instructions:** `**/prompts/**`, `**/*.prompt`, `**/*.prompt.md`, `**/SKILL.md`, `**/.claude/**`, `**/skills/**`, `**/agents/**`, `**/.cursorrules`, `**/.clinerules`, `**/.github/copilot-instructions.md`, any file that contains system prompts, agent instructions, or proprietary prompt engineering
   - These are hardcoded and cannot be overridden — never read or document files matching these patterns
   - **Purpose guard:** The generated docs exist solely to help AI agents understand code patterns, classes, and APIs. Never include business logic descriptions, proprietary algorithms, trade secrets, prompt content, or any content that exposes intellectual property beyond code structure and usage patterns.
5. **Package details:** "What should the context package be named?" (suggest based on project name)
   - **Scoped mode:** This was already asked in Phase 1, skip unless the user wants to change it

### Phase 3: Generate Manifest

**Full mode:** Create `.ai-context-docs/context.json` capturing all preferences from Phase 2.

**Scoped mode:** Create `.ai-context-docs/scoped/<package-name>/context.json`. Also update the main `.ai-context-docs/context.json`:
   - If no main manifest exists, create a minimal one with just `focus.exclude` and `scope: null`. **Warn the user:** "No full init has been run for this repo. The main manifest only contains exclusions. Run `/context-docs-init` (full mode) to generate docs and coverage for the rest of the project."
   - If a main manifest exists but `tracking.coverage` is empty (`{}`), **warn the user** with the same message — scoped packages alone don't provide full project coverage.
   - Add the scoped path to `focus.exclude` to prevent future duplication
   - Remove any coverage entries from `tracking.coverage` whose globs overlap with the scoped path
   - **Clean up overlapping docs:** Check if any existing docs in `.ai-context-docs/docs/` were generated from files inside the scoped path. If so, delete those doc files and their domain subfolders (they are now owned by the scoped package). Only do this if a main manifest already existed before the scoped init — this means a full init was previously run that included the scoped area.
   - **Add scoped reference:** Create or update `.ai-context-docs/docs/_scoped-packages.md` with an entry for the new scoped package (see Phase 5 for format). If main docs exist, rebuild the main package so the reference is searchable.

The manifest drives both initial generation and ongoing hook-based maintenance.

Schema:
```jsonc
{
  "package": {
    "name": "<package-name>",
    "version": "1.0.<YYMMDD>",
    "exportPath": ".ai-context-docs/packages/"
  },
  "project": {
    "path": ".",
    "framework": "dotnet",
    "solutionFile": "<detected .sln>"
  },
  "scope": null,
  "focus": {
    "patterns": ["<detected-patterns>"],
    "domains": {
      "<domain>": { "priority": "high|medium|low", "granularity": "per-class|per-domain" }
    },
    "exclude": ["Tests/**", "obj/**", "bin/**"]
  },
  "conventions": {
    "agentGotchas": ["<user-provided pain points>"]
  },
  "tracking": {
    "lastFullBuild": "<ISO timestamp>",
    "coverage": {
      "<doc-topic>": ["<glob patterns matching source files>"],
      "_untracked": ["<broad catch-all globs covering the project's source areas>"]
    }
  }
}
```

**`_untracked` catch-all globs:** The `_untracked` entry in coverage must always be generated. It should contain broad glob patterns that cover the project's main source directories (e.g., `Data/MBS.Data.Common/*/`, `Entity/Entity.*/`). When a file is edited that doesn't match any known topic but matches an `_untracked` glob, the hook flags it as `_untracked` in `.stale`. The updater agent then investigates whether new areas appeared that need documentation.

Generate `_untracked` globs by looking at the parent directories of the known coverage entries and creating wildcard patterns that would catch new siblings. For example, if you have coverage for `src/Services/Auth/` and `src/Services/Billing/`, the catch-all would be `src/Services/*/`.

For scoped manifests, set `"scope": "<relative-path-to-subfolder>"` and make all coverage globs (including `_untracked`) relative to the repo root (not the scoped folder).

### Phase 4: Generate Documentation

**Full mode:** Create the `.ai-context-docs/docs/` tree.
**Scoped mode:** Create the `.ai-context-docs/scoped/<package-name>/docs/` tree.

Follow these rules:

**Pattern docs (top-level)** — one per detected pattern:
- Use the pattern doc template
- Pull **real code examples** from the actual codebase — never synthetic
- Include class hierarchy diagrams
- Document required overrides/steps
- List common mistakes (from agent gotchas + analysis)
- Cross-link to related pattern and domain docs

**Domain docs (subfolders)** — per the configured granularity:
- **Per-domain**: `_overview.md` with entity table, repository table, and a complete example
- **Per-class**: individual files for each significant entity/repository with namespace, interfaces, table, filter properties, and usage example

**Key principles for doc content:**
- Code-heavy, prose-light — optimized for LLM consumption
- Every example must be pulled from a real class in the project
- Include the full file path in code block comments so agents can find the source
- Document the "why" behind conventions, not just the "what"

### Phase 5: Safety Review

Before building the package, review ALL generated docs for leaks. Scan every `.md` file in the docs directory for:

1. **Secrets/keys** — API keys, connection strings, passwords, tokens, bearer strings, base64-encoded secrets, GUIDs that look like keys (not entity IDs)
   - **Ignore known safe patterns:** `CancellationToken`, `cancellationToken`, method parameter names containing "token" in code signatures, generic type parameters, JWT claim type names — these are code patterns, not secrets
2. **URLs** — internal URLs, IP addresses, server names, database connection endpoints, staging/production hostnames
3. **Credentials** — usernames, email addresses in config, service account names
4. **Proprietary content** — business rules described in prose rather than code structure, algorithm descriptions that reveal trade secrets, pricing logic, licensing mechanisms
5. **Prompt content** — any system prompts, agent instructions, or AI configuration that was accidentally pulled from source files
6. **PII** — customer names, real data examples pulled from test fixtures or seed data
7. **Context7 references** — any mention of `Context7`, `context7`, `resolve-library-id`, `get-library-docs`, or `@anthropic/context` in generated docs. Replace with `context query` CLI syntax.

**If issues are found:**
1. List every finding with the file, line, and what was detected
2. Show the proposed redaction for each (replacement with placeholder)
3. **Ask the user to review:** "I found N potential issues. Please review the list above. Options:"
   - A) Apply all redactions and continue
   - B) Let me review the files manually first (pause and wait)
   - C) Abort — do not build the package
4. Only proceed after explicit user confirmation. Never auto-continue when issues are found.

**If no issues found:** Report "Safety review complete — clean, no issues found." and proceed automatically.

### Phase 6: Build Context Package

**Versioning:** Package versions use the format `<major>.<minor>.<YYMMDD>` (e.g., `1.0.260910`).
- Major/minor are set by the user during init (default `1.0`)
- The patch segment is always today's date in YYMMDD format
- On every rebuild (init, updater agent, verify fix), auto-update the patch to today's date
- Update `package.version` in the manifest before building

**Full mode:**
1. Run: `context add . --path .ai-context-docs/docs --name <package-name> --pkg-version <version> --save .ai-context-docs/packages/`

**Scoped mode:**
1. Run: `context add . --path .ai-context-docs/scoped/<package-name>/docs --name <package-name> --pkg-version <version> --save .ai-context-docs/packages/`
2. **Add scoped reference to main docs:** If a main `.ai-context-docs/docs/` exists, create or update `.ai-context-docs/docs/_scoped-packages.md`:

```markdown
# Scoped Packages

The following areas have dedicated context packages with more detailed documentation.
Query these packages directly instead of looking in the main package.

| Package | Scope | How to Query |
|---------|-------|--------------|
| `<package-name>` | `<scope-path>` | `context query <package-name> '<topic>'` |
```

Append new scoped packages to the table if the file already exists. This ensures agents querying the main package discover that scoped packages exist and know where to look.

3. **Rebuild the main package** after adding the scoped reference so the pointer is included in the main `.db`.

4. If `context` CLI is not available, inform the user and provide install instructions: `npm install -g @neuledge/context`

### Phase 7: Project Integration

1. Add to `CLAUDE.md` (idempotent — check if already present, append scoped packages to existing section):
```markdown
## Context Docs

This project has AI-optimized documentation served via the context CLI. Before implementing against
any pattern or domain in this package, query the context server for guidance:

- **Package:** `<package-name>` (<section-count> sections covering patterns, entities, repositories, filters)
- **Query with short keywords:** e.g. `repository`, `filter handler`, `entity`, `dapper`
- **Query:** `context query <package-name> '<keyword>'`

When you finish a task or phase, check `.ai-context-docs/.stale`. If non-empty, spawn
the context-updater agent (`.ai-context-docs/agents/context-updater.md`) to update
documentation. Do not update docs inline.
```

For scoped packages, add an additional bullet under the Package list:
```markdown
- **Package:** `<scoped-package-name>` (<section-count> sections — scoped to `<path>`)
```

2. Add `.ai-context-docs/.stale` to `.gitignore`

3. Confirm completion and summarize what was generated:
   - Number of pattern docs
   - Number of domain docs
   - Package name and location
   - Remind user to commit `.ai-context-docs/` to the repo

## Important

- Do NOT generate documentation for files you haven't read. Read every source file before documenting it.
- Do NOT create synthetic examples. Every code block must come from an actual file in the project.
- Do NOT document test files unless explicitly asked.
- **ONE question per message. This is critical.** Never combine the Phase 1 naming confirmation with Phase 2 questions. Never ask two Phase 2 questions in the same message. Present the discovery summary, wait for acknowledgement. Ask the package name, wait for confirmation. Then ask each Phase 2 question individually, waiting for a response before proceeding to the next.
- The manifest (`context.json`) must be generated BEFORE any docs, as it drives the doc structure.
- In scoped mode, coverage globs in the manifest must be relative to the repo root, not the scoped folder.
- In scoped mode, auto-add the scoped path to the main manifest's exclude list to prevent duplication.
- NEVER read, document, or include examples from: sensitive files (`appsettings*.json`, `*.secrets.json`, `.env`, `web.config`, `launchSettings.json`, `*.pfx`, `*.pem`, `*.key`, `*.cert`), planning/dev files (`docs/plans/**`, `.planning/**`, `PLAN.md`, `ROADMAP.md`, `TODO.md`, `.ai-context-docs/**`, `.graphene/**`, `CLAUDE.md`), or prompts/AI instructions (`**/prompts/**`, `**/*.prompt`, `**/SKILL.md`, `**/.claude/**`, `**/skills/**`, `**/agents/**`, `**/.cursorrules`, `**/.clinerules`).
- **Purpose guard:** These docs exist solely to help AI agents understand code patterns, classes, and APIs. Never include proprietary algorithms, trade secrets, prompt content, or business logic beyond what's needed to show code structure and usage.
- **NEVER publish, push, or submit packages to any external registry.** All context packages are private internal documentation. Only use `context add` with local `--save` paths. Do not use `context publish`, `context push`, or any command that uploads to the the context CLI community registry or any remote endpoint.
