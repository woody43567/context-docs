---
name: context-docs-init
description: |
  Analyze a .NET project and generate AI-optimized context documentation for Context7.
  Discovers entities, repositories, patterns, and conventions, then generates searchable docs.
  Supports scoped mode: pass a subfolder path to generate a separate package for just that area.
user-invocable: true
---

# /context-docs-init — Generate AI-Optimized Context Documentation

## Overview

Analyze a .NET project and generate AI-optimized markdown documentation for serving via Context7. The documentation focuses on patterns, conventions, and real code examples that help AI agents correctly implement against the project's APIs.

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
```
Analyzes only the specified subfolder. Generates docs in `.ai-context-docs/scoped/<package-name>/docs/` with a separate manifest at `.ai-context-docs/scoped/<package-name>/context.json`. The scoped path is automatically added to the main manifest's exclude list (if one exists) to avoid duplication.

**Determine the mode from the arguments.** If a path argument is provided, use scoped mode. Otherwise, use full mode.

## Process

### Phase 1: Project Discovery

1. **Full mode:** Ask the user which project path to analyze (default: current working directory)
   **Scoped mode:** Use the provided path argument. Confirm with the user: "I'll analyze `<path>` as a scoped package. What should it be named?"
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
5. **Package details:** "What should the context package be named?" (suggest based on project name)
   - **Scoped mode:** This was already asked in Phase 1, skip unless the user wants to change it

### Phase 3: Generate Manifest

**Full mode:** Create `.ai-context-docs/context.json` capturing all preferences from Phase 2.

**Scoped mode:** Create `.ai-context-docs/scoped/<package-name>/context.json`. Also update the main `.ai-context-docs/context.json` exclude list to add the scoped path (if main manifest exists).

The manifest drives both initial generation and ongoing hook-based maintenance.

Schema:
```jsonc
{
  "package": {
    "name": "<package-name>",
    "version": "1.0.0",
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

### Phase 5: Build Context Package

**Full mode:**
1. Run: `context add . --path .ai-context-docs/docs --name <package-name> --pkg-version <version> --save .ai-context-docs/packages/`

**Scoped mode:**
1. Run: `context add . --path .ai-context-docs/scoped/<package-name>/docs --name <package-name> --pkg-version <version> --save .ai-context-docs/packages/`

2. If `context` CLI is not available, inform the user and provide install instructions: `npm install -g @anthropic/context`

### Phase 6: Project Integration

1. Add to `CLAUDE.md` (idempotent — check if already present, append scoped packages to existing section):
```markdown
## Context Docs

This project has AI-optimized documentation served via Context7. Before implementing against
any pattern or domain in this package, query the context server for guidance:

- **Package:** `<package-name>` (<section-count> sections covering patterns, entities, repositories, filters)
- **Query with short keywords:** e.g. `repository`, `filter handler`, `entity`, `dapper`
- **Use Context7 MCP tools:** `resolve-library-id` → `get-library-docs` with topic keywords

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
- Ask questions ONE AT A TIME during Phase 2.
- The manifest (`context.json`) must be generated BEFORE any docs, as it drives the doc structure.
- In scoped mode, coverage globs in the manifest must be relative to the repo root, not the scoped folder.
- In scoped mode, auto-add the scoped path to the main manifest's exclude list to prevent duplication.
