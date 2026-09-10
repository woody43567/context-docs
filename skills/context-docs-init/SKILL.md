---
name: context-docs-init
description: |
  Analyze a .NET project and generate AI-optimized context documentation for Context7.
  Discovers entities, repositories, patterns, and conventions, then generates searchable docs.
user-invocable: true
---

# /context-docs-init — Generate AI-Optimized Context Documentation

## Overview

Analyze a .NET project and generate AI-optimized markdown documentation for serving via Context7. The documentation focuses on patterns, conventions, and real code examples that help AI agents correctly implement against the project's APIs.

## Process

### Phase 1: Project Discovery

1. Ask the user which project path to analyze (default: current working directory)
2. Scan the project to discover:
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

### Phase 3: Generate Manifest

Create `.ai-context-docs/context.json` capturing all preferences from Phase 2. The manifest drives both initial generation and ongoing hook-based maintenance.

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
      "<doc-topic>": ["<glob patterns matching source files>"]
    }
  }
}
```

### Phase 4: Generate Documentation

Create the `.ai-context-docs/docs/` tree following these rules:

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

1. Run: `context add . --path .ai-context-docs/docs --name <package-name> --pkg-version <version> --save .ai-context-docs/packages/`
2. If `context` CLI is not available, inform the user and provide install instructions: `npm install -g @anthropic/context`

### Phase 6: Project Integration

1. Add to `CLAUDE.md` (idempotent — check if already present):
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
