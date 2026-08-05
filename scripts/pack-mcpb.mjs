#!/usr/bin/env node
// Stage and pack the MCPB bundle for the Claude Desktop Chat tab (PLUGIN-PRD PC-03, P-14).
//
// Nobody should ever run `mcpb pack` by hand against a hand-staged directory — that is how a
// released bundle ends up carrying a stale server. This script is the only supported path, and
// the release workflow is the only thing expected to run it.
//
// It does three things and nothing else:
//   1. refuses to pack a dist/ that is older than src/ (the PQ-06 staleness class)
//   2. stages mcpb/manifest.json + dist/index.js into build/mcpb/ with the version stamped
//   3. invokes the official mcpb CLI so the bundle is validated, not just zipped
//
// Version, per the bundle-only tagging decision: the plugin stays version-less (P-08), so the
// stamp names the *bundle*. A tag build gets the tag; anything else gets a commit-stamped
// prerelease so an ad-hoc bundle can never be mistaken for a release.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stageDir = join(repoRoot, 'build', 'mcpb');
const outDir = join(repoRoot, 'build');

function fail(message) {
  console.error(`pack-mcpb: ${message}`);
  process.exit(1);
}

function git(args) {
  try {
    // stderr is piped, not inherited: `describe --exact-match` on an untagged commit is an
    // expected miss, and its "fatal:" line reads as a build failure when it reaches the log.
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

/** Newest mtime under a directory tree. */
function newestMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const mtime = entry.isDirectory() ? newestMtime(full) : statSync(full).mtimeMs;
    if (mtime > newest) newest = mtime;
  }
  return newest;
}

// --- 1. staleness guard -------------------------------------------------------------------
const bundlePath = join(repoRoot, 'dist', 'index.js');
if (!existsSync(bundlePath)) {
  fail('dist/index.js is missing. Run `npm run build` first.');
}
if (newestMtime(join(repoRoot, 'src')) > statSync(bundlePath).mtimeMs) {
  fail('dist/index.js is older than src/. Run `npm run build` before packing.');
}

// --- 2. version ---------------------------------------------------------------------------
// MANABASE_BUNDLE_VERSION is how the release workflow passes the tag in.
const override = process.env.MANABASE_BUNDLE_VERSION?.trim();
const exactTag = git(['describe', '--tags', '--exact-match']);
const shortSha = git(['rev-parse', '--short', 'HEAD']) || 'unknown';
const raw = override || exactTag;
const version = raw ? raw.replace(/^v/, '') : `0.0.0-dev+${shortSha}`;

if (!/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(version)) {
  fail(`refusing to stamp a non-semver version: ${version}`);
}

// --- 3. stage -----------------------------------------------------------------------------
rmSync(stageDir, { recursive: true, force: true });
mkdirSync(join(stageDir, 'server'), { recursive: true });

const manifest = JSON.parse(readFileSync(join(repoRoot, 'mcpb', 'manifest.json'), 'utf8'));
manifest.version = version;
writeFileSync(join(stageDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

cpSync(bundlePath, join(stageDir, 'server', 'index.js'));

const icon = join(repoRoot, 'mcpb', 'icon.png');
if (existsSync(icon)) {
  cpSync(icon, join(stageDir, 'icon.png'));
}

// --- 4. pack ------------------------------------------------------------------------------
const outFile = join(outDir, 'manabase.mcpb');
rmSync(outFile, { force: true });

// Invoke the CLI's entry script with this same Node rather than going through `npx`. The
// shim is a .cmd on Windows, and spawning one without a shell fails EINVAL on current Node —
// resolving the real script sidesteps that and pins us to the installed devDependency instead
// of whatever the network hands back.
const mcpbRoot = join(repoRoot, 'node_modules', '@anthropic-ai', 'mcpb');
if (!existsSync(mcpbRoot)) {
  fail('@anthropic-ai/mcpb is not installed. Run `npm ci`.');
}
const mcpbBin = JSON.parse(readFileSync(join(mcpbRoot, 'package.json'), 'utf8')).bin;
const cliPath = join(mcpbRoot, typeof mcpbBin === 'string' ? mcpbBin : Object.values(mcpbBin)[0]);

execFileSync(process.execPath, [cliPath, 'pack', stageDir, outFile], {
  cwd: repoRoot,
  stdio: 'inherit',
});

console.log(`pack-mcpb: wrote ${outFile} (version ${version})`);
if (!raw) {
  console.log('pack-mcpb: no tag — this is a dev bundle, not a release artifact.');
}
