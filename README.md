# Distributed Systems Playground

A public playground of interactive distributed-systems visualizations and
hand-built mini systems, developed chapter-by-chapter while reading
*Designing Data-Intensive Applications* (2nd edition). It is a learning
vehicle first and a portfolio second — the interesting parts (simulation
engine, storage engine, Raft, Gossip Glomers) are written by hand; AI agents
handle rendering, UI, scaffolding, tests, and docs.

## Two halves

1. **Website** (`/site`) — browser-based interactive visualizations
   (consistent hashing, quorums, replication lag, vector clocks, isolation
   levels, 2PC, LSM lifecycle, ...) built on a deterministic discrete-event
   simulation engine. 100% static; deployable to Vercel or GitHub Pages. No
   hosted backend, ever.
2. **Backend track** (`/glomers`, `/engines`, `/prototypes`) — local Go
   programs: Gossip Glomers challenges, a mini LSM storage engine, a
   Raft-backed KV store, and weekend-sized system design prototypes. These
   run on a developer machine only.

**Language rule: browser = TypeScript, everything else = Go.** No third
language.

**The bridge:** Go programs emit structured JSON event logs
([schema](logs/schema.md)); interesting logs are committed to `/logs`; the
site's replay visualizer animates them. That schema is the only contract
between the two languages.

## Monorepo map

```
site/               Vite + React + TS website
  src/engine/       deterministic sim engine (hand-written; stubs + tests now)
  src/concepts/     concept modules — one per visualization (hand-written)
  src/renderers/    PixiJS rendering layer (agent-owned)
  src/pages/        one page per visualization
glomers/            Gossip Glomers challenges (Go, via Maelstrom)
engines/lsm/        mini LSM storage engine (Go)
engines/raft/       Raft-backed KV store (starts Dec 2026)
prototypes/         weekend-sized system design prototypes (Go)
logs/               committed JSON event logs + schema
docs/               planning docs
```

## Running the site

```sh
cd site
npm install
npm run dev      # local dev server
npm run build    # production build
npm test         # vitest (engine acceptance tests are skipped until implemented)
```

## Go programs

Requires Go 1.22+. `go.work` at the root ties the modules together.

```sh
cd glomers/echo && go build    # see glomers/echo/README.md for Maelstrom setup
cd engines/lsm  && go build
```
