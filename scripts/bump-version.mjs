#!/usr/bin/env node
// Compute the next plugin version from the commit range and write it into plugin.json
// (Track C Slice 18, executing PLUGIN-PRD P-08). This is the single implementation of
// "what version is next," runnable identically on a developer's machine and on the runner —
// the same reason PC-03 criterion 7 lives inside pack-mcpb.mjs rather than in a workflow step.
//
// It has two modes, because `main` is branch-protected and the release job may not push to it:
//   * default / --dry-run / --set  — the AUTHOR runs this on a release branch. It reads the
//     conventional-commit prefixes across `<newest v* tag>..HEAD`, maps them to a semver bump, and
//     (unless --dry-run) writes the result into .claude-plugin/plugin.json in place. That write is
//     committed INTO the PR, so the version reaches `main` through the normal PR flow.
//   * --check                      — the release JOB runs this on `push: main`, after the versioned
//     plugin.json is already merged. It computes nothing and writes nothing; it only decides whether
//     the committed version is a new, releasable semver (present, valid, not already tagged, ahead of
//     the newest tag) and emits that decision. The job then tags and publishes without ever touching
//     the protected branch.
// No dependency, nothing that reaches the network.
//
// Mapping (this spec's decision, not an inherited one; highest across the range wins):
//   feat:                                              -> minor
//   fix: / perf:                                       -> patch
//   docs: chore: ci: test: refactor: style: build: revert:  -> no release
//   no conventional prefix                             -> no release, logged by subject
//   breaking marker (`!` or a `BREAKING CHANGE` footer) -> a MAJOR intent, but see nextVersion:
//     while the base version is 0.x it is CLAMPED TO MINOR, never major. Semver permits this and
//     the alternative ships a 1.0.0 as a side effect of a commit message. This is deliberate; a
//     future reader will otherwise read the clamp as a bug.
//
// "No release" is success, not failure: a documentation-only merge exits 0 and reports the
// decision. A non-zero exit would turn every docs PR red.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { appendFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------------------------
// Pure functions — exported for tests/bump-version.test.ts, which exercises them over arrays of
// commit subjects rather than over `git log` (the repository's history changes under such a test).
// ---------------------------------------------------------------------------------------------

const RANK = { none: 0, patch: 1, minor: 2, major: 3 };
const BY_RANK = ['none', 'patch', 'minor', 'major'];

const NO_RELEASE_TYPES = new Set([
  'docs',
  'chore',
  'ci',
  'test',
  'refactor',
  'style',
  'build',
  'revert',
]);

/** The conventional-commit type and breaking marker of a single subject line. */
export function commitType(subject) {
  const m = /^([a-zA-Z]+)(\([^)]*\))?(!)?:/.exec(subject.trim());
  if (m === null) return { type: null, breaking: false };
  return { type: m[1].toLowerCase(), breaking: m[3] === '!' };
}

/** The bump level a single subject implies, ignoring the base version. */
export function levelOf(subject) {
  const { type, breaking } = commitType(subject);
  if (breaking || /BREAKING[ -]CHANGE/.test(subject)) return 'major';
  if (type === 'feat') return 'minor';
  if (type === 'fix' || type === 'perf') return 'patch';
  // Both a recognized no-release type and an unrecognized/absent prefix land here as "none".
  return 'none';
}

/**
 * Classify a whole range. Returns `{ bump, driving, unprefixed }`:
 *  - `bump`      the highest level across the range ("major" | "minor" | "patch" | "none")
 *  - `driving`   the subjects that contributed a releasable level, with that level
 *  - `unprefixed` subjects with no conventional prefix at all — logged, never silently dropped
 */
export function analyzeSubjects(subjects) {
  let rank = 0;
  const driving = [];
  const unprefixed = [];
  for (const subject of subjects) {
    const level = levelOf(subject);
    if (commitType(subject).type === null) unprefixed.push(subject);
    if (level !== 'none') driving.push({ subject, level });
    rank = Math.max(rank, RANK[level]);
  }
  return { bump: BY_RANK[rank], driving, unprefixed };
}

/** The plan's headline signature: the range's bump level, subjects only. */
export function classifyBump(subjects) {
  return analyzeSubjects(subjects).bump;
}

/** Strict semver for the numeric core: rejects a leading zero in any component (so `0.1.01` is out). */
export function isStrictSemver(v) {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:[-+].+)?$/.test(v);
}

/** Compare two semver numeric cores. Returns -1, 0, or 1. Ignores any prerelease/build suffix. */
export function compareSemver(a, b) {
  const core = (v) => v.split(/[-+]/, 1)[0].split('.').map((n) => Number.parseInt(n, 10));
  const pa = core(a);
  const pb = core(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

/**
 * The next version from a base and a bump level. The 0.x clamp lives here: a "major" bump while
 * the base major is 0 becomes a minor, never a major. Returns null for "none" (no release).
 */
export function nextVersion(base, bump) {
  if (bump === 'none') return null;
  const core = base.split(/[-+]/, 1)[0];
  const parts = core.split('.').map((n) => Number.parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n))) {
    throw new Error(`base version is not a numeric semver core: ${base}`);
  }
  let [major, minor, patch] = parts;
  let level = bump;
  if (level === 'major' && major === 0) level = 'minor'; // the 0.x clamp
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * Write `version` into plugin.json text in place. If the key exists, replace its value; if it is
 * absent (the first run), insert it immediately after the `"name"` line. A replacement *function*
 * throughout — never a replacement string — so a `$` in an argument can never splice the file into
 * itself. Every other byte, including line endings, is preserved.
 */
export function writePluginVersion(text, version) {
  if (/"version"\s*:/.test(text)) {
    return text.replace(/("version"\s*:\s*")[^"]*(")/, (_full, pre, post) => `${pre}${version}${post}`);
  }
  const inserted = text.replace(
    /^([ \t]*)("name"\s*:\s*"[^"]*",)(\r?\n)/m,
    (_full, indent, nameLine, nl) => `${indent}${nameLine}${nl}${indent}"version": "${version}",${nl}`,
  );
  if (inserted === text) throw new Error('could not find the "name" line to insert "version" after');
  return inserted;
}

// ---------------------------------------------------------------------------------------------
// CLI — behind a main-guard so importing this module for tests does not execute it.
// ---------------------------------------------------------------------------------------------

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pluginJsonPath = join(repoRoot, '.claude-plugin', 'plugin.json');

function fail(message) {
  console.error(`bump-version: ${message}`);
  process.exit(1);
}

function git(args) {
  try {
    // stderr piped, not inherited: `describe --abbrev=0` with no tag is an expected miss whose
    // "fatal:" line would otherwise read as a build failure in the log.
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

/** The version currently in plugin.json, or null on the first run before the key exists. */
function readPluginVersion() {
  const parsed = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));
  return typeof parsed.version === 'string' ? parsed.version : null;
}

/** Emit machine-readable output for the workflow when $GITHUB_OUTPUT is set, else nothing here. */
function emitOutputs(outputs) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  const lines = Object.entries(outputs)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  appendFileSync(file, `${lines}\n`);
}

/**
 * CI decision path (`--check`): the release job runs this AFTER the versioned plugin.json is
 * already on `main` via the merged PR. It never computes from the range and never writes anything —
 * it only decides whether the committed version is a new, releasable one. This is what lets the job
 * avoid pushing to a branch-protected `main`: the version rides in the PR, the job just reads it.
 */
function check() {
  const version = readPluginVersion();
  if (version === null) {
    console.log('bump-version: plugin.json carries no version — nothing to release.');
    emitOutputs({ release: 'false', version: '', bump: 'none' });
    process.exit(0);
  }
  if (!isStrictSemver(version)) {
    fail(`plugin.json version is not semver: ${version} (a leading zero in a component is rejected).`);
  }
  if (git(['tag', '-l', `v${version}`]) !== '') {
    console.log(`bump-version: v${version} is already tagged — already released, nothing to do.`);
    emitOutputs({ release: 'false', version: '', bump: 'none' });
    process.exit(0);
  }
  const newestTag = git(['describe', '--tags', '--abbrev=0']);
  const newestVersion = newestTag ? newestTag.replace(/^v/, '') : null;
  if (newestVersion && compareSemver(version, newestVersion) <= 0) {
    fail(
      `plugin.json version ${version} is not ahead of the newest tag v${newestVersion} — ` +
        'refusing to release a non-advancing version.',
    );
  }
  console.log(`bump-version: plugin.json version ${version} is releasable (newest tag ${newestTag || 'none'}).`);
  emitOutputs({ release: 'true', version, bump: 'committed' });
  process.exit(0);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--check')) {
    check();
    return;
  }
  const dryRun = argv.includes('--dry-run');
  const setIndex = argv.indexOf('--set');
  const override = setIndex !== -1 ? argv[setIndex + 1] : undefined;

  const newestTag = git(['describe', '--tags', '--abbrev=0']);
  const range = newestTag ? `${newestTag}..HEAD` : 'HEAD (no tag — from the root commit)';
  const logArgs = newestTag ? ['log', `${newestTag}..HEAD`, '--format=%s'] : ['log', 'HEAD', '--format=%s'];
  const rawLog = git(logArgs);
  const subjects = rawLog ? rawLog.split('\n').filter((s) => s.length > 0) : [];

  // Base: plugin.json's version when present; on the first run it is absent, so the newest tag
  // (with its leading `v` stripped) is the base. Never hardcode a number — read the tag.
  const pluginVersion = readPluginVersion();
  const base = pluginVersion ?? (newestTag ? newestTag.replace(/^v/, '') : '0.0.0');

  const analysis = analyzeSubjects(subjects);

  let version;
  let bumpLabel;
  if (override !== undefined) {
    // --set is the manual escape hatch. It still goes through semver and tag validation below.
    version = override.replace(/^v/, '');
    bumpLabel = 'set';
  } else {
    bumpLabel = analysis.bump;
    version = nextVersion(base, analysis.bump); // null when no release is warranted
  }

  console.log(`bump-version: range ${range}`);
  console.log(`bump-version: ${subjects.length} commit(s) in range`);
  for (const { subject, level } of analysis.driving) {
    console.log(`bump-version:   [${level}] ${subject}`);
  }
  for (const subject of analysis.unprefixed) {
    console.log(`bump-version:   [no prefix — no release contribution] ${subject}`);
  }
  console.log(`bump-version: current version ${base}${pluginVersion === null ? ' (from tag; plugin.json has none yet)' : ''}`);

  if (version === null) {
    console.log('bump-version: no releasable commit in range — no release.');
    emitOutputs({ release: 'false', version: '', bump: 'none' });
    process.exit(0);
  }

  if (!isStrictSemver(version)) {
    fail(`refusing a non-semver version: ${version} (a leading zero in a component is rejected).`);
  }
  if (git(['tag', '-l', `v${version}`]) !== '') {
    fail(`v${version} already exists as a tag — that version is spent and a released bundle cannot be withdrawn.`);
  }

  console.log(`bump-version: computed version ${version} (${bumpLabel})`);

  if (dryRun) {
    console.log('bump-version: --dry-run, wrote nothing.');
    emitOutputs({ release: 'true', version, bump: bumpLabel });
    process.exit(0);
  }

  const before = readFileSync(pluginJsonPath, 'utf8');
  const after = writePluginVersion(before, version);
  writeFileSync(pluginJsonPath, after);
  console.log(`bump-version: wrote version ${version} into ${pluginJsonPath}`);
  emitOutputs({ release: 'true', version, bump: bumpLabel });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
