#!/usr/bin/env bun
/**
 * Usage: bun run bump-version [patch|minor|major|<X.Y.Z>]
 *
 * Updates version in:
 *   - package.json
 *   - src-tauri/tauri.conf.json
 *   - src-tauri/Cargo.toml
 *
 * Then commits and tags if inside a git repository.
 */

import { execSync } from "child_process";

const bumpType = process.argv[2];

if (!bumpType) {
  console.error("Usage: bun run bump-version [patch|minor|major|<X.Y.Z>]");
  process.exit(1);
}

// ── Read current version ────────────────────────────────────────────────────

const pkgPath = "package.json";
const pkg = JSON.parse(await Bun.file(pkgPath).text()) as { version: string; [k: string]: unknown };
const current = pkg.version;
const [maj, min, pat] = current.split(".").map(Number);

let next: string;
if (bumpType === "major") {
  next = `${maj + 1}.0.0`;
} else if (bumpType === "minor") {
  next = `${maj}.${min + 1}.0`;
} else if (bumpType === "patch") {
  next = `${maj}.${min}.${pat + 1}`;
} else if (/^\d+\.\d+\.\d+$/.test(bumpType)) {
  next = bumpType;
} else {
  console.error(`Invalid bump type: "${bumpType}". Use patch, minor, major, or X.Y.Z`);
  process.exit(1);
}

console.log(`Bumping version: ${current} → ${next}`);

// ── Update package.json ─────────────────────────────────────────────────────

pkg.version = next;
await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`  ✓ package.json`);

// ── Update src-tauri/tauri.conf.json ────────────────────────────────────────

const tauriConfPath = "src-tauri/tauri.conf.json";
const tauriConf = JSON.parse(await Bun.file(tauriConfPath).text()) as { version: string; [k: string]: unknown };
tauriConf.version = next;
await Bun.write(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");
console.log(`  ✓ src-tauri/tauri.conf.json`);

// ── Update src-tauri/Cargo.toml ─────────────────────────────────────────────

const cargoPath = "src-tauri/Cargo.toml";
const cargo = await Bun.file(cargoPath).text();
// Replace only the first `version = "..."` line (package version, not dependency versions)
const updatedCargo = cargo.replace(/^version = ".*"/m, `version = "${next}"`);
if (updatedCargo === cargo) {
  console.warn(`  ⚠ src-tauri/Cargo.toml — version line not found, skipping`);
} else {
  await Bun.write(cargoPath, updatedCargo);
  console.log(`  ✓ src-tauri/Cargo.toml`);
}

// ── Regenerate Cargo.lock to reflect the new version ────────────────────────

const cargoLockPath = "src-tauri/Cargo.lock";
execSync("cargo generate-lockfile --manifest-path src-tauri/Cargo.toml", { stdio: "pipe" });
console.log(`  ✓ src-tauri/Cargo.lock`);

// ── Git commit + tag ─────────────────────────────────────────────────────────

try {
  execSync(`git add ${pkgPath} ${tauriConfPath} ${cargoPath} ${cargoLockPath}`, { stdio: "pipe" });
  execSync(`git commit -m "chore: bump version to ${next}"`, { stdio: "pipe" });
  execSync(`git tag v${next}`, { stdio: "pipe" });
  console.log(`  ✓ git commit + tag v${next}`);
} catch {
  console.log(`  — git operations skipped (not a git repo or nothing to commit)`);
}

console.log(`\nDone. New version: ${next}`);
