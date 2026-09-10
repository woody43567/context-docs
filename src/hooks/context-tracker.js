#!/usr/bin/env node

/**
 * context-tracker.js — PostToolUse hook for context-docs plugin
 *
 * Called after Edit/Write/MultiEdit operations. Checks if the changed file
 * matches any coverage glob in the project's context.json manifest(s).
 * If it does, appends the matched topic to .ai-context-docs/.stale
 *
 * Supports both main manifest and scoped manifests under .ai-context-docs/scoped/
 *
 * Usage: node context-tracker.js "<file_path>"
 */

const fs = require("fs");
const path = require("path");

const CONTEXT_DIR = ".ai-context-docs";
const MAIN_MANIFEST = ".ai-context-docs/context.json";
const STALE_PATH = ".ai-context-docs/.stale";

function findProjectRoot(startDir) {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, MAIN_MANIFEST))) {
      return dir;
    }
    // Also check for scoped-only setups (no main manifest but scoped dir exists)
    if (fs.existsSync(path.join(dir, CONTEXT_DIR, "scoped"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function matchesGlob(filePath, globPattern) {
  const regexStr = globPattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "{{DOUBLESTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{DOUBLESTAR\}\}/g, ".*");

  const regex = new RegExp(`^${regexStr}`);
  return regex.test(filePath);
}

function checkManifest(manifestPath, relativeChanged, prefix) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch {
    return [];
  }

  const coverage = manifest.tracking?.coverage;
  if (!coverage) return [];

  const matched = [];
  for (const [topic, globs] of Object.entries(coverage)) {
    for (const glob of globs) {
      if (matchesGlob(relativeChanged, glob)) {
        matched.push(prefix ? `${prefix}:${topic}` : topic);
        break;
      }
    }
  }
  return matched;
}

function findScopedManifests(projectRoot) {
  const scopedDir = path.join(projectRoot, CONTEXT_DIR, "scoped");
  const manifests = [];

  try {
    const entries = fs.readdirSync(scopedDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(scopedDir, entry.name, "context.json");
        if (fs.existsSync(manifestPath)) {
          manifests.push({ name: entry.name, path: manifestPath });
        }
      }
    }
  } catch {
    // No scoped directory — that's fine
  }

  return manifests;
}

function main() {
  const changedFile = process.argv[2];
  if (!changedFile) {
    process.exit(0);
  }

  const projectRoot = findProjectRoot(process.cwd());
  if (!projectRoot) {
    process.exit(0);
  }

  const absoluteChanged = path.resolve(changedFile);
  const relativeChanged = path.relative(projectRoot, absoluteChanged);

  const matchedTopics = [];

  // Check main manifest
  const mainManifestPath = path.join(projectRoot, MAIN_MANIFEST);
  if (fs.existsSync(mainManifestPath)) {
    matchedTopics.push(...checkManifest(mainManifestPath, relativeChanged, ""));
  }

  // Check all scoped manifests
  const scopedManifests = findScopedManifests(projectRoot);
  for (const scoped of scopedManifests) {
    matchedTopics.push(...checkManifest(scoped.path, relativeChanged, scoped.name));
  }

  if (matchedTopics.length === 0) {
    process.exit(0);
  }

  // Read existing stale topics
  const stalePath = path.join(projectRoot, STALE_PATH);
  let existingStale = new Set();
  try {
    const content = fs.readFileSync(stalePath, "utf-8").trim();
    if (content) {
      content.split("\n").forEach((line) => existingStale.add(line.trim()));
    }
  } catch {
    // File doesn't exist yet
  }

  for (const topic of matchedTopics) {
    existingStale.add(topic);
  }

  fs.writeFileSync(stalePath, [...existingStale].join("\n") + "\n");
}

main();
