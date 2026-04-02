#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

function fail(message) {
  console.error(`release-candidate gate failed: ${message}`);
  process.exit(1);
}

function runGit(args) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function parseArgs(argv) {
  let manifestPath = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") {
      manifestPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(`Usage: npm run qa:release-candidate -- --manifest <path>

Required manifest shape:
{
  "branch": "spoa-121-r2-candidate",
  "commit": "f44e29c5786b121c1145ef0d9e63fb347d0bd7d7",
  "issues": [
    { "id": "SPOA-121", "url": "/SPOA/issues/SPOA-121" }
  ],
  "validation": [
    "npm run lint",
    "npm run typecheck"
  ]
}`);
      process.exit(0);
    }
  }

  if (!manifestPath) {
    fail("missing --manifest <path>");
  }

  return { manifestPath };
}

function readManifest(manifestPath) {
  const absolutePath = resolve(process.cwd(), manifestPath);
  let parsed;

  try {
    parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    fail(`could not read manifest ${manifestPath}: ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("manifest must be a JSON object");
  }

  const { branch, commit, issues, validation } = parsed;

  if (typeof branch !== "string" || branch.length === 0) {
    fail("manifest.branch must be a non-empty string");
  }

  if (!/^[0-9a-f]{40}$/i.test(commit ?? "")) {
    fail("manifest.commit must be a 40-character git SHA");
  }

  if (!Array.isArray(issues) || issues.length === 0) {
    fail("manifest.issues must contain at least one linked issue");
  }

  for (const issue of issues) {
    if (!issue || typeof issue !== "object") {
      fail("each manifest issue must be an object");
    }
    if (typeof issue.id !== "string" || issue.id.length === 0) {
      fail("each manifest issue must include a non-empty id");
    }
    if (typeof issue.url !== "string" || !issue.url.startsWith("/")) {
      fail("each manifest issue must include a repo-internal url starting with /");
    }
  }

  if (!Array.isArray(validation) || validation.length === 0) {
    fail("manifest.validation must contain at least one validation command");
  }

  for (const command of validation) {
    if (typeof command !== "string" || command.trim().length === 0) {
      fail("each validation command must be a non-empty string");
    }
  }

  return parsed;
}

function main() {
  const { manifestPath } = parseArgs(process.argv.slice(2));
  const manifest = readManifest(manifestPath);
  const normalizedManifestPath = manifestPath.replace(/\\/g, "/");

  const currentBranch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  const status = runGit(["status", "--porcelain"]);

  if (status.length > 0) {
    fail("workspace is dirty; only clean candidates can be handed to QA");
  }

  if (currentBranch !== manifest.branch) {
    fail(`manifest branch ${manifest.branch} does not match current branch ${currentBranch}`);
  }

  try {
    runGit(["rev-parse", "--verify", `${manifest.commit}^{commit}`]);
  } catch (error) {
    fail(`manifest commit ${manifest.commit} does not exist in this repository`);
  }

  try {
    runGit(["merge-base", "--is-ancestor", manifest.commit, "HEAD"]);
  } catch (error) {
    fail(`manifest commit ${manifest.commit} is not reachable from HEAD`);
  }

  const postManifestFilesRaw = runGit(["diff", "--name-only", `${manifest.commit}..HEAD`]);
  const postManifestFiles = postManifestFilesRaw
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);

  if (postManifestFiles.some((file) => file !== normalizedManifestPath)) {
    fail(
      `only ${normalizedManifestPath} may differ after manifest commit ${manifest.commit}; found ${postManifestFiles.join(", ")}`
    );
  }

  let upstreamDelta;
  try {
    upstreamDelta = runGit(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]);
  } catch (error) {
    fail("current branch has no upstream; push the candidate branch before QA handoff");
  }

  if (upstreamDelta !== "0\t0" && upstreamDelta !== "0 0") {
    fail(`branch is not fully pushed to upstream (HEAD...@{upstream} = ${upstreamDelta})`);
  }

  console.log("release-candidate gate passed");
  console.log(`manifest: ${manifestPath}`);
  console.log(`branch: ${manifest.branch}`);
  console.log(`commit: ${manifest.commit}`);
  console.log(`issues: ${manifest.issues.map((issue) => issue.id).join(", ")}`);
  console.log(`validation commands: ${manifest.validation.length}`);
}

main();
