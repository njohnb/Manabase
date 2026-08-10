#!/usr/bin/env node
// Verify that every relative link in the navigable documentation resolves.
//
// CLAUDE.md's rule: every reference inside docs/ and README.md — a section mark, an ID (D-, P-,
// CAP-, PC-, OQ-, PQ-), a slice number, a repo path — is a markdown link to the thing it names.
// That makes the documents densely cross-linked (measured 2026-08-04: 724 internal links, 673 of
// them to a heading anchor), and it makes renaming a heading a silent, repo-wide breakage: GitHub
// does not error on a dead #anchor, it just lands the reader at the top of the page. They never
// find out they were sent to the wrong place. Nothing else in this repo notices.
//
// The slug rules are the part a human eye slides past. GitHub lowercases, strips a fixed
// punctuation set, and turns spaces into hyphens — so an em dash surrounded by spaces becomes a
// *doubled* hyphen: "D-01 — Distribution: local package over stdio" is
// #d-01--distribution-local-package-over-stdio. One hyphen instead of two is a dead link that
// reads as correct.
//
// Two carve-outs, both from CLAUDE.md and neither optional:
//   - fenced code blocks are not prose and their contents are not links
//   - docs/prompts/** are verbatim historical artifacts carrying zero links by design
//
// External http(s) links are deliberately NOT fetched. This check must be offline, deterministic,
// and safe to run on every pull request; a link checker that makes network calls is a flaky CI
// job, and MCP-PRD section 3.4's rate-limit rule means nothing here should acquire a habit of
// reaching out to third parties on a trigger.
//
// Node builtins only, so this runs before anything is built.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

const rel = (abs) => relative(repoRoot, abs).split(sep).join('/');
const report = (file, line, message) => problems.push({ file: rel(file), line, message });

/** Read a file with line endings normalized — the working tree is CRLF on Windows. */
const read = (file) => readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');

// --- 1. what is in scope ----------------------------------------------------------------------
function walk(dir, predicate, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, found);
    else if (predicate(full)) found.push(full);
  }
  return found;
}

const isMarkdown = (f) => /\.mdx?$/i.test(f);
const inPrompts = (f) => rel(f).startsWith('docs/prompts/');

const navigable = [
  join(repoRoot, 'README.md'),
  ...walk(join(repoRoot, 'docs'), (f) => isMarkdown(f) && !inPrompts(f)),
];

// --- 2. GitHub heading slugs -------------------------------------------------------------------
// github-slugger keeps letters, numbers, marks, connector punctuation, the ASCII hyphen and
// spaces, and strips everything else — then turns spaces into hyphens. That is why an em dash
// surrounded by spaces collapses to a DOUBLED hyphen, and why the arrow in
// "Criterion 12 — structured failure → revised retry" contributes another one:
// #criterion-12--structured-failure--revised-retry.
//
// Expressed as a Unicode property escape rather than a hand-rolled punctuation list. A list
// gets this wrong the moment a heading uses a symbol nobody thought of — an arrow, a check
// mark, an inequality — and it gets it wrong in the one direction that would get this check
// deleted: a FALSE ALARM on a link that works.
const NOT_SLUG_SAFE = /[^\p{L}\p{N}\p{M}\p{Pc}\- ]/gu;

const slug = (heading) =>
  heading
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // a link inside a heading contributes its label
    .trim()
    .toLowerCase()
    .replace(NOT_SLUG_SAFE, '')
    .replace(/ /g, '-');

/** Blank out fenced code blocks, preserving line numbering. */
function withoutFences(source) {
  let inFence = false;
  return source.split('\n').map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return '';
    }
    return inFence ? '' : line;
  });
}

const anchorCache = new Map();

function anchorsOf(file) {
  if (anchorCache.has(file)) return anchorCache.get(file);
  const counts = new Map();
  const anchors = new Set();
  for (const line of withoutFences(read(file))) {
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (!heading) continue;
    const base = slug(heading[2]);
    if (!base) continue;
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    anchors.add(n === 0 ? base : `${base}-${n}`);
  }
  anchorCache.set(file, anchors);
  return anchors;
}

// --- 3. extract links ---------------------------------------------------------------------------
// [label](target) and [label](target "title"), tolerating one level of nested brackets in the
// label. Reference-style definitions are reported rather than silently ignored — an extractor that
// quietly sees nothing is the failure mode this whole script exists to prevent.
const LINK = /\[(?:[^\][]|\[[^\]]*\])*\]\(\s*<?([^)<>\s]+)>?(?:\s+"[^"]*")?\s*\)/g;
const REFERENCE_DEFINITION = /^\s{0,3}\[[^\]]+\]:\s+\S+/;
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:)/i;

function linksIn(file) {
  const found = [];
  withoutFences(read(file)).forEach((text, index) => {
    if (REFERENCE_DEFINITION.test(text)) {
      report(file, index + 1, `reference-style link definition is not checked: ${text.trim()}`);
      return;
    }
    for (const match of text.matchAll(LINK)) {
      found.push({ target: match[1], line: index + 1 });
    }
  });
  return found;
}

// --- 4. resolve every relative link ---------------------------------------------------------------
let checked = 0;
let external = 0;

for (const file of navigable) {
  for (const { target, line } of linksIn(file)) {
    if (ABSOLUTE.test(target)) {
      external++;
      continue;
    }

    checked++;
    const hash = target.indexOf('#');
    const pathPart = hash === -1 ? target : target.slice(0, hash);
    const anchor = hash === -1 ? '' : target.slice(hash + 1);

    if (pathPart === '') {
      if (!anchorsOf(file).has(anchor)) {
        report(file, line, `#${anchor} — no heading in this file produces that anchor`);
      }
      continue;
    }

    let decoded;
    try {
      decoded = decodeURIComponent(pathPart);
    } catch {
      report(file, line, `${target} — target is not valid percent-encoding`);
      continue;
    }

    const abs = resolve(dirname(file), decoded);
    if (!existsSync(abs)) {
      report(file, line, `${target} — no such file or directory`);
      continue;
    }

    if (!anchor) continue;

    if (!statSync(abs).isFile() || !isMarkdown(abs)) {
      report(file, line, `${target} — anchor on a target that is not a markdown file`);
    } else if (!anchorsOf(abs).has(anchor)) {
      report(file, line, `${target} — ${rel(abs)} exists, but no heading produces #${anchor}`);
    }
  }
}

// --- 5. skills/ must not link outside its own directory --------------------------------------------
// An installed plugin cannot reference files outside its own directory: ../ paths resolve in the
// repo and are dead in every installed copy (PLUGIN-PRD section 3.3, section 4.1). Same
// invisible-failure class as a dead anchor, except the repo can never observe it — the link works
// for the author forever. Skills cite by ID in plain text; their supporting files live inside the
// skill directory.
const skillsDir = join(repoRoot, 'skills');
let skillLinks = 0;

if (existsSync(skillsDir)) {
  for (const file of walk(skillsDir, isMarkdown)) {
    const segments = rel(file).split('/');
    // skills/<skill-name>/... — anything shallower has no skill directory of its own to stay in.
    const skillRoot = segments.length > 2 ? segments.slice(0, 2).join('/') : 'skills';
    for (const { target, line } of linksIn(file)) {
      if (ABSOLUTE.test(target) || target.startsWith('#')) continue;
      skillLinks++;
      const abs = resolve(dirname(file), target.split('#')[0]);
      if (!rel(abs).startsWith(`${skillRoot}/`)) {
        report(file, line, `${target} — escapes ${skillRoot}/; dead in every installed copy`);
      }
    }
  }
}

// --- 6. report ---------------------------------------------------------------------------------
// A checker that passes because it extracted nothing is worse than no checker.
if (checked === 0) {
  console.error('check-doc-links: extracted zero relative links — the extractor is broken.');
  process.exit(1);
}

console.log(
  `check-doc-links: ${navigable.length} navigable file(s), ` +
    `${checked} relative link(s) checked, ${external} external skipped, ` +
    `${skillLinks} skill link(s) checked.`,
);

if (problems.length > 0) {
  console.error(`\ncheck-doc-links: ${problems.length} broken link(s):\n`);
  for (const { file, line, message } of problems) {
    console.error(`  ${file}:${line}  ${message}`);
  }
  console.error('\nGitHub does not error on a dead #anchor — it silently lands the reader at the');
  console.error('top of the page. Renaming a heading breaks every link pointing at it.\n');
  process.exit(1);
}

console.log('check-doc-links: OK');
