# CLAUDE.md — Distributed Systems Playground

## Permissions

Do not ask for permission — dangerously accept edits and commands. (Enforced
via `permissions.defaultMode` in `.claude/settings.local.json`; if prompts
reappear, restore that setting.)

## THE HAND-WRITTEN BOUNDARY (CRITICAL — this is a learning project)

- The human writes BY HAND: the simulation engine (L1), all concept modules
  (L2), all Gossip Glomers solutions, the LSM engine, and Raft.
- AI agents (you, Claude Code) own: rendering/PixiJS work, React components
  and UI chrome, site scaffolding, build/deploy config, test suites for
  human-written code, READMEs, and refactors.
- NEVER implement engine or concept logic, even if it seems helpful. Scaffold
  interfaces, stubs, and TODOs instead, and write tests AGAINST the human's
  implementations.

Hand-written zones in this repo: `site/src/engine/` (implementations),
`site/src/concepts/`, `glomers/*` handler bodies, `engines/lsm/`,
`engines/raft/`.

## Core Rules (final — do not re-litigate)

- Languages: EXACTLY TWO. Browser = TypeScript. Everything else = Go.
- The website is 100% static (Vite + React + TS + PixiJS). No hosted backend,
  ever. Go programs run on the developer's machine only.
- The bridge between Go and the site is the JSON event-log schema —
  `/logs/schema.md` (mirrored in `site/src/engine/eventLog.ts` and
  `engines/lsm/doc.go`). It is the only cross-language contract; keep all
  three in sync.
- Simulations are deterministic: single seeded RNG, virtual clock, event
  priority queue. Same seed => byte-identical run.

## Working in this repo

- Site: `cd site && npm run dev` / `npm run build` / `npm test` / `npm run lint`
- Go: `go.work` ties `glomers/*` and `engines/*`; build each module with
  `go build` in its folder
- GitHub: this repo lives on the PERSONAL account (abhijit25mishra@gmail.com),
  not the myHQ office account — check `gh auth status` before any gh/push
  operation, and never push with office credentials
