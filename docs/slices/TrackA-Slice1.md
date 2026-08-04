# Track A — Slice 1: Server skeleton

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

**Goal.** Produce a committed `dist/index.js` that starts a stdio MCP server, completes the
initialize handshake, answers `tools/list` with an empty list, and owns *all* configuration at
the entry point. No tools, no Scryfall code — this slice fixes the entry-point shape, the
config contract, and the test harness that every later slice reuses.

## Preconditions (repo state when you start)

- `src/`, `tests/`, `dist/` contain only `.gitkeep` placeholders. No lockfile, no `node_modules`.
- `package.json`: `"type": "module"`; scripts `build` (`esbuild src/index.ts --bundle
  --platform=node --target=node18 --format=esm --outfile=dist/index.js`), `typecheck`
  (`tsc --noEmit`), `test` (`node --test`); devDependencies `@modelcontextprotocol/sdk ^1.30.0`,
  `esbuild`, `typescript`, `@types/node`.
- `tsconfig.json`: `strict`, `module: NodeNext`, `moduleResolution: NodeNext`, `noEmit`,
  `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`; includes
  `src/**/*.ts` and `tests/**/*.ts`.
- `.gitignore` deliberately does **not** ignore `dist/` — built output is committed
  (PLUGIN-PRD P-09). Do not "fix" this.
- Plugin files exist at the repo root (`.claude-plugin/`, `.mcp.json`, `skills/`, `README.md`).
  They are another track's job — do not touch them.

## Context

Manabase is a Magic: The Gathering MCP server (Scryfall-backed card search) that ships inside a
Claude Code plugin; `.mcp.json` starts it as `node ${CLAUDE_PLUGIN_ROOT}/dist/index.js`. This is
slice 1 of 6 in Track A (the server track): skeleton → HTTP client → search handler → price
correctness → tool wiring → live acceptance.

## Deliverables

| File | Action |
|---|---|
| `package-lock.json` | created by `npm install`; commit it |
| `tsconfig.json` | add `"allowImportingTsExtensions": true` (legal because `noEmit` is set) |
| `package.json` | change `"test"` to `"node --test tests/"` |
| `src/config.ts` | new — `Config` type + `resolveConfig` |
| `src/index.ts` | new — entry point, server skeleton |
| `tests/config.test.ts` | new |
| `dist/index.js` | built and **committed** |

## Requirements

1. **Import style.** All relative imports in `src/` and `tests/` use explicit `.ts` extensions
   (`import { resolveConfig } from "./config.ts"`). esbuild resolves these when bundling, and
   the Node ≥23 test runner strips types natively so `node --test tests/` runs the TypeScript
   test files directly. Use erasable-syntax TypeScript only: no `enum`, no `namespace`, no
   parameter properties. `verbatimModuleSyntax` means type-only imports must be `import type`.
2. **Entry point owns config.** `src/index.ts` is the **only** file in the codebase that may
   read `process.env` or `process.platform`. It calls `resolveConfig(process.env,
   process.platform)` once and passes the result down. Nothing below the entry point reaches
   for the environment — that is what keeps every other module a plain testable function
   (MCP-PRD D-03, §3.2).
3. **Config resolution** (`src/config.ts`):
   - `userAgent`: `manabase-mtg/<version> (+https://github.com/OWNER/manabase)`. Scryfall
     **requires** a User-Agent naming the application; default library agents are disallowed.
     Define `const APP_VERSION = "0.0.0"` in `config.ts` with a comment to keep it in sync
     with `package.json` (the build is a bundle; do not read `package.json` at runtime).
     Leave `OWNER` as-is — Track B substitutes the real GitHub owner before release.
   - `cacheDir`: `CLAUDE_PLUGIN_DATA` env var when set and non-empty (the plugin harness sets
     it; the directory survives plugin updates). Otherwise a platform user-cache directory:
     - `win32`: `%LOCALAPPDATA%\manabase` (fall back to `<homedir>\AppData\Local\manabase`)
     - `darwin`: `<homedir>/Library/Caches/manabase`
     - other: `$XDG_CACHE_HOME/manabase`, else `<homedir>/.cache/manabase`
     Nothing writes to it in Phase 1 — this slice fixes the *resolution rule* only. Do not
     create the directory.
   - `scryfallBaseUrl`: `"https://api.scryfall.com"`. Exists so tests can point a client at a
     fake; nothing else configures it.
4. **Server skeleton** (`src/index.ts`): use the SDK's low-level `Server` (not `McpServer`) so
   tool schemas can later be plain JSON Schema with no zod import:
   ```ts
   import { Server } from "@modelcontextprotocol/sdk/server/index.js";
   import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
   import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
   ```
   - Server info: name `manabase-mtg`, version `APP_VERSION`. Capabilities: `{ tools: {} }`.
   - Register a `ListToolsRequestSchema` handler returning `{ tools: [] }` (Slice 5 replaces it).
   - Connect a `StdioServerTransport`.
5. **stdout is the protocol channel.** stdio MCP frames are newline-delimited JSON on stdout.
   `console.log` (or any stdout write) anywhere in server code corrupts the stream. Incidental
   diagnostics go to `console.error`. This rule binds every later slice too.
6. **Keep the SDK a devDependency.** The build bundles it into `dist/index.js`; the shipped
   file must run with **no** `node_modules` present (the plugin starts it as bare `node
   dist/index.js` with no install step). Add no dependencies of any kind.
7. **Rebuild and commit `dist/`.** `dist/index.js` is committed output; every slice that
   changes `src/` ends with `npm run build` and a commit that includes `dist/index.js`.

## Interface contracts (canonical — later slices consume these verbatim)

```ts
// src/config.ts
export interface Config {
  /** Sent on every outbound request. Names the app per Scryfall's requirement. */
  userAgent: string;
  /** CLAUDE_PLUGIN_DATA when set; otherwise the platform user-cache dir. Unused until a capability needs persistence. */
  cacheDir: string;
  /** "https://api.scryfall.com" in production; overridable so tests never hit the network. */
  scryfallBaseUrl: string;
}

export function resolveConfig(
  env: Record<string, string | undefined>,
  platform?: string, // defaults to process.platform; injectable for tests
): Config;
```

Repo layout this track builds toward (identical in every slice doc):

```
src/index.ts              entry point — the only file that may read process.env   (Slice 1, rewired Slice 5)
src/config.ts             Config + resolveConfig                                  (Slice 1)
src/result.ts             Result union                                            (Slice 2)
src/scryfall/client.ts    rate-limited HTTP client                                (Slice 2)
src/scryfall/types.ts     minimal Scryfall wire types                             (Slice 3)
src/scryfall/prices.ts    price resolution — naive in Slice 3, correct in Slice 4
src/tools/card-search.ts  card_search handler                                     (Slice 3)
src/tools/register.ts     tool definitions + dispatch + registration              (Slice 5)
scripts/cap01-live.mjs    live acceptance harness                                 (Slice 6)
tests/                    mirrors src/; node --test; fixtures under tests/fixtures/
```

## Out of scope — do NOT

- No tools, no HTTP code, no Scryfall anything (Slices 2–5).
- No new npm dependencies, dev or runtime.
- No abstraction layers — the SDK transport is the abstraction (MCP-PRD D-04). No `ITransport`,
  no factory, no config framework.
- Do not touch `.claude-plugin/`, `.mcp.json`, `skills/`, `README.md`, or `docs/` other than
  this checklist.
- Do not create `cacheDir` on disk, and do not read env anywhere but `src/index.ts`.

## Acceptance criteria

1. `npm run typecheck`, `npm run build`, `npm test` all pass.
2. `node dist/index.js` completes an MCP initialize round-trip and answers `tools/list` with
   an empty tool list (smoke test below).
3. `dist/index.js` runs from a directory containing no `node_modules` (copy it to a temp dir
   and run it there) — proves the bundle is self-contained.
4. `resolveConfig` unit tests pass for: `CLAUDE_PLUGIN_DATA` set (wins on every platform);
   unset on `win32`, `darwin`, and `linux` (each resolves the documented path); `userAgent`
   contains `manabase-mtg/`.
5. `git status` after the final commit shows a clean tree including the rebuilt `dist/index.js`
   and `package-lock.json`.

## Testing requirements

- `tests/config.test.ts` with `node:test` + `node:assert/strict`. Call `resolveConfig` with
  hand-built env records and explicit platform strings — no mutation of `process.env`.
- `noUncheckedIndexedAccess` is on: index into arrays/records via guards or non-null
  assertions in test code as needed.
- `exactOptionalPropertyTypes` is on: omit optional keys rather than assigning `undefined`.

## Verification steps

```bash
npm install
npm run typecheck && npm run build && npm test
# stdio smoke test (Git Bash):
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
 | node dist/index.js
# expect two JSON responses: initialize result naming manabase-mtg, then {"tools":[]}
# self-containment check:
mkdir -p /tmp/mb-smoke && cp dist/index.js /tmp/mb-smoke/ && printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' | node /tmp/mb-smoke/index.js
```

## References

- `docs/DEV-ROADMAP.md` §4, Slice 1 (goal and done-when source).
- `docs/MCP-PRD.md` D-02 (runtime), D-03/§3.2 (entry-point config, plain-function testability),
  D-04 (no abstraction layers).
- `docs/PLUGIN-PRD.md` P-09 (committed `dist/`, started as `node dist/index.js`), §4.5
  (`CLAUDE_PLUGIN_DATA` and the standalone fallback rule).
