#!/usr/bin/env node

/**
 * context-tracker.js — PostToolUse hook for context-docs plugin
 *
 * Called after Edit/Write/MultiEdit operations. Checks if the changed file
 * matches any coverage glob in the project's context.json manifest.
 * If it does, appends the matched topic to .ai-context-docs/.stale
 *
 * Usage: node context-tracker.js "<file_path>"
 */

const fs = require("fs");
const path = require("path");

const MANIFEST_PATH = ".ai-context-docs/context.json";
const STALE_PATH = ".ai-context-docs/.stale";

function findProjectRoot(startDir) {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, MANIFEST_PATH))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function matchesGlob(filePath, globPattern) {
  // Simple glob matching — supports ** and * patterns
  // Convert glob to regex
  const regexStr = globPattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "{{DOUBLESTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{DOUBLESTAR\}\}/g, ".*");

  const regex = new RegExp(`^${regexStr}`);
  return regex.test(filePath);
}

function main() {
  const changedFile = process.argv[2];
  if (!changedFile) {
    process.exit(0);
  }

  // Find project root (where .ai-context-docs/context.json lives)
  const projectRoot = findProjectRoot(process.cwd());
  if (!projectRoot) {
    // No manifest — this project hasn't been initialized, skip silently
    process.exit(0);
  }

  const manifestPath = path.join(projectRoot, MANIFEST_PATH);
  const stalePath = path.join(projectRoot, STALE_PATH);

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch {
    // Manifest unreadable — skip silently
    process.exit(0);
  }

  const coverage = manifest.tracking?.coverage;
  if (!coverage) {
    process.exit(0);
  }

  // Make the changed file path relative to project root
  const absoluteChanged = path.resolve(changedFile);
  const relativeChanged = path.relative(projectRoot, absoluteChanged);

  // Check which topics match the changed file
  const matchedTopics = [];
  for (const [topic, globs] of Object.entries(coverage)) {
    for (const glob of globs) {
      if (matchesGlob(relativeChanged, glob)) {
        matchedTopics.push(topic);
        break;
      }
    }
  }

  if (matchedTopics.length === 0) {
    process.exit(0);
  }

  // Read existing stale topics
  let existingStale = new Set();
  try {
    const content = fs.readFileSync(stalePath, "utf-8").trim();
    if (content) {
      content.split("\n").forEach((line) => existingStale.add(line.trim()));
    }
  } catch {
    // File doesn't exist yet — that's fine
  }

  // Add new topics (deduplicate)
  for (const topic of matchedTopics) {
    existingStale.add(topic);
  }

  // Write back
  fs.writeFileSync(stalePath, [...existingStale].join("\n") + "\n");
}

main();
