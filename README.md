# Distributed Systems Playground

A public playground of interactive distributed-systems visualizations and
hand-built mini systems, developed chapter-by-chapter while reading
*Designing Data-Intensive Applications* (2nd edition). A learning vehicle
first and a portfolio second — the interesting parts are written by hand.

Solo project. Plan, timeline, and chapter deadlines: **[PLAN.md](./PLAN.md)**.
Working notes and findings: **[journal/](./journal/)**.

## Current state

`site/` only — a Vite + React + TypeScript shell listing the visualizations,
all of them still `coming-soon`. Everything else was cleared out on
2026-08-15.

Those folders are **deferred, not dropped** — the Go engines, Glomers
challenges, prototypes, and event logs are all scheduled in
[PLAN.md § Folder roadmap](./PLAN.md#folder-roadmap). Each one gets created by
the work that fills it rather than sitting empty in advance.

First up: consistent hashing ring, standalone, no shared engine.

## How this is built

- **Browser = TypeScript. Everything else = Go.** No third language.
- **The site is 100% static.** No hosted backend, ever. Go programs run
  locally and publish JSON event logs the site can replay.
- **No shared simulation engine until November 2026.** The first three
  visualizations are standalone and may duplicate code; the engine is
  *extracted* from them rather than designed up front.
- Every project gets a page: live sim, replayable recording, or write-up +
  demo GIF.

## Running the site

```sh
cd site
npm install
npm run dev      # local dev server
npm run build    # production build
npm test         # vitest
npm run lint
```
