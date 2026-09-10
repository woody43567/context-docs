# context-docs

AI-optimized context documentation generator for .NET packages. A Claude Code plugin that analyzes your project, generates pattern-focused documentation, and maintains it automatically as your code evolves.

## What it does

- Analyzes .NET projects to discover entities, repositories, filters, patterns, and conventions
- Generates AI-optimized markdown documentation (code-heavy, prose-light)
- Builds searchable `.db` packages using the [context](https://github.com/neuledge/context) CLI for local serving
- Automatically tracks code changes and flags stale docs via PostToolUse hooks
- Delegates doc updates to a specialist subagent to minimize context overhead

## Installation

### From GitHub

```
/plugin marketplace add woody43567/context-docs
/plugin install context-docs
```

## Usage

### Initial setup

Run `/context-docs-init` in any .NET project. The skill will:

1. Scan the project and present its findings
2. Ask clarifying questions about priorities and granularity
3. Generate a manifest (`.ai-context-docs/context.json`)
4. Generate documentation in `.ai-context-docs/docs/`
5. Build a searchable `.db` package in `.ai-context-docs/packages/`
6. Add a maintenance instruction to `CLAUDE.md`

### Scoped mode

Target a specific subfolder or wildcard pattern:

```
/context-docs-init src/MyPackage
/context-docs-init src/MBS.ImageStudio.*
```

### Health check

Run `/context-docs-verify` to check for stale docs, missing references, manifest issues, and more.

### Ongoing maintenance

After installation, the plugin works automatically:

1. The PostToolUse hook tracks which files you edit
2. When you finish a task, the main agent checks for stale docs
3. If docs are stale, it spawns the context-updater subagent
4. The subagent updates affected docs and rebuilds the package

### Per-project structure

```
.ai-context-docs/
├── context.json          # manifest — focus areas, conventions, coverage
├── .stale                # stale topic tracker (gitignored)
├── docs/
│   ├── *.md              # pattern docs (top-level)
│   └── {domain}/         # domain subfolders
│       ├── _overview.md
│       └── *.md          # per-class docs (if configured)
├── scoped/               # scoped packages (optional)
│   └── {package}/
│       ├── context.json
│       └── docs/
└── packages/
    └── *.db              # built context packages
```

## Requirements

- [Claude Code](https://claude.ai/code) with plugin support
- [context CLI](https://github.com/neuledge/context) (`npm install -g @neuledge/context`) for building `.db` packages
- A .NET project to document
