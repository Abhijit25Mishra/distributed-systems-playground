# Distributed Systems Playground — Plan (rev. Aug 2026)

**Status:** Ch 1 done, ~halfway through Ch 2. Solo project.
**Core window:** Aug 2026 → Dec 2026. **Slow lane:** Jan 2027 onward.

Notes for reading this document:

- **Goal for the core window:** reach DDIA Ch 8 (ideally Ch 9) by 31 Dec 2026,
  with the matching prototypes shipped. Chapters 10–14 and the heavier builds
  move to the slow lane and finish whenever they finish.
- Pace is deliberately ~2–3 items per month, not 9. Everything here is done
  solo alongside a full-time job.
- Sources: DDIA 2nd ed concepts, Fly.io Gossip Glomers (`Glomers:`), and
  [arpitbbhayani/system-design-questions](https://github.com/arpitbbhayani/system-design-questions)
  (`Arpit:`).
- *(weekend)* = 1–2 days. *(stretch)* = cut first, no guilt.
- **No shared simulation engine until November.** Early visualizations are
  standalone and are allowed to duplicate code; the engine gets *extracted*
  from that duplication once three of them exist.
- Language rule: browser = TypeScript, everything else = Go. Site is static;
  Go programs run locally and publish JSON event logs the site can replay.
- Every project gets a page on the site: live sim, replayable recording, or
  write-up + demo GIF.
- **Hard deadline context:** job switch targeted for late 2027 (Sept–Dec).
  Interview prep takes over from roughly mid-2027, so the project should be
  presentable and self-explanatory by **June 2027** — polish and write-ups
  matter more than finishing every item.

---

## Folder roadmap

The repo was stripped to `site/` on 2026-08-15. Those folders were **deferred,
not abandoned** — every one of them is scheduled below. What was deleted was
empty scaffolding: directories and placeholder READMEs created before there
was anything to put in them.

**Rule: a folder is created by the work that fills it, in the same change.**
Never in advance.

| Folder | Comes back | Brought by |
|---|---|---|
| `lab/` | ✅ Aug 2026 | #1 — one folder per visualization: design doc, learning notes, practice code. Created alongside each viz, outside `site/` |
| `glomers/` | Aug 2026 | #2 Glomers: Echo |
| `engines/lsm/` | Sep 2026 | #4 LSM part 1 (memtable, WAL, SSTable flush) |
| `prototypes/` | Oct 2026 | #8 Encoding & schema evolution demo |
| `logs/` + event-log schema | Oct 2026 | #7 LSM lifecycle animation — first replay of a recorded Go run |
| `site/src/renderers/` | when a viz needs a rendering layer | #1 onward, if PixiJS is pulled in |
| Simulation engine + `site/src/concepts/` | **Nov 2026** | #9 — **extracted** from the first three visualizations, not designed up front |
| `engines/raft/` | Slow lane, 2027 | #20 Raft-backed KV store |
| `docs/` | as write-ups accumulate | #23 polish pass |

Two notes carried forward from the 2026-08-15 findings (full detail in
`journal/2026-08-15.md`):

- **The event-log schema gets designed when `logs/` returns, not before.** The
  deleted version was a contract between two things that didn't exist yet, and
  it required hand-mirroring across three files. When it comes back, generate
  one side from the other.
- **Anything intended to run in the browser later should be written I/O-free
  from the start** — pure state machine, transport and storage injected. That
  costs nothing to do up front (it's better Go regardless) and is what makes
  Raft and the Glomers handlers reusable in a browser sim. Retrofitting it
  across six finished challenges is expensive.

---

## List 1 — Prototypes, month by month

### August 2026 *(2 weeks left)*

1. Consistent hashing ring (viz) — with the load-skew comparison vs
   fixed-partition hashing
2. Glomers: Echo *(evening task — Go + Maelstrom toolchain warm-up)*

### September 2026

3. ~~Latency percentiles explorer (viz)~~ — **shipped early, 25 Aug**, and
   built entirely by the agent at my request. I read the concept and there was
   nothing in it I needed to write by hand; it earns its place on the site
   rather than in my hands. One-off waiver of the hand-written boundary, noted
   in `latencyPercentiles/model.ts` and in the 2026-08-25 journal entry.
4. Mini LSM storage engine — part 1 (memtable, WAL, SSTable flush)
5. Glomers: Unique ID Generation *(evening task)*

### October 2026

6. Mini LSM storage engine — part 2 (compaction, bloom filters)
7. LSM lifecycle animation (viz) — flagship
8. Encoding & schema evolution demo: JSON vs Protobuf vs Avro *(weekend)*

### November 2026

9. Simulation engine — **extracted** from the three existing visualizations
10. Replication lag simulator (viz) — read-your-writes / monotonic-reads
    violations
11. Quorum reads/writes explorer (viz)

### December 2026

12. Hash vs range sharding hot spots (viz)
13. Transaction isolation levels playground
14. Two-phase commit with coordinator crash (viz) *(stretch)*

**End-of-year checkpoint:** site live with 5–6 visualizations, a working LSM
engine, 2 Glomers challenges, and DDIA through Ch 8.

---

### Slow lane — Jan 2027 onward *(no fixed dates)*

15. Unreliable network playground (viz) — exposes the engine's knobs directly
16. Vector clocks / happens-before diagram (viz)
17. Glomers: Broadcast (a–d)
18. Glomers: Grow-only Counter
19. Glomers: Kafka-style Log
20. Raft-backed KV store (+ JSON event-log emission)
21. Raft replay visualizer — capstone
22. Mini log-based message broker
23. Site polish pass, READMEs, write-ups — **target: presentable by June 2027**

### Optional pool — pick up whenever a weekend is free

Arpit: Online/Offline Indicator · Word Dictionary · Recent Searches · Realtime
Claps · Newly Unread Indicator · SQL-backed KV Store · Superfast KV Store ·
Distributed Cache · Airline Check-in · Flash Sale · Hashtag Service · User
Affinity · Photo Tagging · Who's Near Me · SQL-backed Message Broker ·
Synchronized Queue Consumers · Counting Impressions at Scale · Load Balancer ·
Design S3 · Remote File Sync · Distributed Task Scheduler · Text-based Search
Engine · Video Pipeline · Image Service · OnePic · Blogging Platform · Live
Commentary

---

## List 2 — DDIA 2nd Edition chapter deadlines

### Core window

| Chapter | Finish by |
|---|---|
| ~~Ch 1 — Trade-Offs in Data Systems Architecture~~ | ✅ done |
| Ch 2 — Defining Nonfunctional Requirements | Aug 24, 2026 |
| Ch 3 — Data Models and Query Languages | Sep 7, 2026 |
| Ch 4 — Storage and Retrieval | Sep 30, 2026 |
| Ch 5 — Encoding and Evolution | Oct 19, 2026 |
| Ch 6 — Replication | Nov 16, 2026 |
| Ch 7 — Sharding | Nov 30, 2026 |
| Ch 8 — Transactions | Dec 21, 2026 |
| Ch 9 — The Trouble with Distributed Systems | Dec 31, 2026 *(stretch)* |

### Slow lane

| Chapter | Target |
|---|---|
| Ch 9 — The Trouble with Distributed Systems | Jan 2027 *(if not done)* |
| Ch 10 — Consistency and Consensus | Feb 2027 |
| Ch 11 — Batch Processing | Mar 2027 |
| Ch 12 — Stream Processing | Apr 2027 |
| Ch 13 — A Philosophy of Streaming Systems | May 2027 |
| Ch 14 — Doing the Right Thing | May 2027 |
