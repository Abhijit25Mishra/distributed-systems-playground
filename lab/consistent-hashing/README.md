# Consistent Hashing Ring — design doc

**Plan item:** #1 (Aug 2026) · **DDIA:** Ch 7 (Sharding), read ahead
**Status:** v2 — 2026-08-16. Invariants + Definition of done deliberately
deferred. Changes from v1 listed at the bottom.

---

## Problem statement

Visualize a consistent hashing ring: keys are assigned to nodes by hashing
both onto a shared circular keyspace, and a key belongs to the first node
found walking clockwise from the key's position.

The page must show **why the algorithm exists** — that adding or removing a
node relocates only a small fraction of keys, where naive `hash(key) % N`
relocates almost all of them.

**What this is not:** a network simulator, a replication system, or a load
balancer. There is no message passing here. It is a mapping function under a
workload.

## Entities

Derived from the core signature — `lookup(key, ring) -> node`:

| Entity | What it is |
|---|---|
| **Key** | An item that must live on some node. Hashes to a ring position; does **not** own an arc. |
| **Node** | A physical machine that owns keys. Occupies **V** ring positions, not one. |
| **VirtualNode** | One of a node's V positions on the ring. This is what the ring is actually made of — a `(position, nodeId, replicaIndex)` triple. The lookup walk lands on a *virtual* node and resolves to its owner. |
| **Ring** | The circular keyspace `[0, 2³²)`, holding all virtual node positions in sorted order. Size matters only in that it must be large enough that collisions are negligible — 2³² is convention, not requirement. |
| **HashFunction** | Maps a key id or node id to a position. Needs **uniform distribution and avalanche** (one bit of input flips ~half the output bits). Not cryptographic — FNV-1a or MurmurHash3, not SHA-256. |

Interaction objects — user-facing, not part of the algorithm:

| Object | What it is |
|---|---|
| **Operation** | One mutation: add node, remove node, add keys, set V. |
| **Run** | An ordered list of Operations. *The* record of a scenario. |
| **Assignment** | Derived map of key → node at a given point. Computed, never stored. |

**Cut from v1** — these failed the deletion test (remove them and consistent
hashing still works exactly as specified):

- ~~Connections~~ — no message passing in this algorithm
- ~~LB node, client node types~~ — scope borrowed from viz #15
- ~~Event as "the entire record"~~ — renamed: **Run** is the record,
  **Operation** is the single unit. There are no events here because there is
  no clock.

> **Correction to the v1 entity notes.** "Each node/key occupies 1 space on
> the ring" is not right in two ways: a node occupies **V** positions (that is
> the entire point of virtual nodes), and a key does not *occupy* a position
> at all — it hashes to one and then walks clockwise to find its owner. Only
> virtual nodes are actually *on* the ring.

## Users

- **Reader** *(primary)* — lands on the page and wants to understand
  consistent hashing without touching a control. Gets a default scenario
  already running and a visible before/after on node removal.
- **Operator** — changes parameters, adds and removes nodes mid-run, compares
  outcomes.
- **Author** — defines the algorithm's logic. Not a website visitor; the value
  of naming this role is that it forces a clean seam between the algorithm and
  the renderer.

## Functional requirements

**Keys accumulate.** Keys arrive at a rate the operator sets, and once
assigned they **stay assigned** — they are stored data, not transient
requests. This is what makes "only K/N keys move" a meaningful claim. See the
open decision below.

**Topology**

1. Operator can add a **Node**.
2. Operator can remove a **Node**, before a run or mid-run.
3. Operator can set **virtual nodes per node (V)** — the central parameter.

**Keys**

4. Operator sets a key arrival rate (keys/sec); on run, **Keys** are generated
   and assigned continuously.
5. Operator can add a specific **Key** by id, to trace one by hand.
6. For any **Key**, the page shows its ring position, the clockwise walk, and
   the **VirtualNode** it landed on — *why* it maps where it maps.

**The lesson**

7. On any topology change, report **how many keys moved**, as a count and a
   percentage of total.
8. Show **load distribution** across nodes, with a skew metric, and how it
   tightens as V increases.
9. Run the identical workload through **`hash(key) % N`** alongside, so the
   difference in keys-moved is visible side by side. *This is the point of the
   page.*

**Timeline**

10. Every Operation appends to the **Run**; operator can seek to any index.
11. A summary appears at the end of a run: keys moved, final distribution,
    skew, and the `% N` comparison.

**Stretch**

12. Operator can switch the **HashFunction**, including a deliberately poor
    one, to see clustering wreck the distribution.

## Non-functional requirements

| # | Requirement | Reason |
|---|---|---|
| N1 | Run is generated **instantaneously (<100ms)**, then played back at a human-watchable rate | Seeking requires the whole run to exist; playback rate is a separate display concern |
| N2 | Seek to any index in **<16ms** | Scrubbing must track the cursor at frame rate — 100ms is the *click* threshold, too loose for a drag |
| N3 | ≤ **10⁵ entities** on the ring | Compute stays trivial at this scale (~2ms); it is the render that breaks first |
| N4 | Individual rendering only up to ~**2,000 keys**; aggregate into arcs/bins above that | 100,000 individually drawn dots is not readable *or* renderable at 60fps |
| N5 | **<50MB** so several runs coexist | Carried from v1 — see note below, this is likely 100× over-provisioned |
| N6 | Lookup is a **pure function** of (key, ring state) — no hidden state | Makes the whole run recomputable, which is what N1 and N2 depend on |
| N7 | n/a: availability, security, cost, durability | Static site, no backend, no user data, nothing persists across reload |

> **N5 is probably far too generous.** A Run is just a seed plus an operation
> list — kilobytes. If keys are stored explicitly instead of regenerated,
> 10⁵ keys × ~16 bytes ≈ 1.6MB per run. Either way the data is nowhere near
> 50MB; the real memory consumer will be the **renderer** (sprites, geometry),
> not the model. Worth re-deriving the budget against the renderer once one
> exists.

## Open decisions

**1. Determinism — ✅ RESOLVED 2026-08-16: seeded.**

v1 scoped seeded reproducibility out, which contradicted N1/N2 — seeking back
to index `i` must reproduce the same keys, and without a seed it cannot.

Resolved by taking the seed. A `Run` carries one, all key generation draws
from a single seeded PRNG, and replay is byte-identical. This makes scenarios
shareable by URL and makes every test in `ring.test.ts` repeatable.
`N5`'s memory concern disappears with it: a run is a seed plus an operation
list, so nothing needs storing.

**2. Do keys accumulate or are they transient?**

v1 says keys are "consumed" by a node (transient requests) *and* that removing
a node causes remapping (implies keys persist). Only one can be true.

Written above as **accumulating**, because the remapping story — and therefore
the `% N` comparison — only means anything if keys persist. That is also the
DDIA Ch 7 framing: keys are data partitioned across nodes. Transient routing
is a valid second view, but it cannot teach the lesson this page exists for.

**3. Mid-run vs pre-run topology changes** — v1 flagged uncertainty here.
Allow **both**: once a Run is an ordered operation list, "remove node at index
40" and "remove node before starting" are the same thing with different
indices. No extra machinery.

## API / data model *(proposed — review before coding)*

**Language: TypeScript, in `site/`.** This visualization is ~200 lines of
hashing logic; a Go/WASM build would cost ~900KB gzipped to deliver it. The
Go-in-browser question becomes real at the November engine extraction, not
here.

```ts
type Position = number        // uint32 range, [0, 2**32)
type NodeId = string
type KeyId = string

interface VirtualNode { position: Position; nodeId: NodeId; replica: number }

interface Ring {
  addNode(id: NodeId, virtualNodes: number): void
  removeNode(id: NodeId): void
  lookup(key: KeyId): NodeId        // hash → binary search → next clockwise
  positions(): readonly VirtualNode[]   // sorted, for rendering
}

type Operation =
  | { kind: 'addNode'; id: NodeId; virtualNodes: number }
  | { kind: 'removeNode'; id: NodeId }
  | { kind: 'addKeys'; count: number }
  | { kind: 'setVirtualNodes'; value: number }

interface Run {
  seed: number
  operations: Operation[]
  stateAt(index: number): Assignment      // replay operations[0..index]
  diff(a: number, b: number): KeyMove[]   // which keys moved between states
}
```

> **The classic bug lives in `lookup`.** After binary-searching for the first
> virtual node at a position `>=` the key's, a key hashing past the *last*
> virtual node must **wrap to index 0**. Forget the wrap and every key in the
> final arc silently reports no owner. Worth an invariant of its own.

## Invariants — what makes the implementation correct

> **Deferred** (2026-08-16, by choice). To be written before any tests.

## Definition of done

> **Deferred** (2026-08-16, by choice).

---

## Open questions

- Is the ring drawn as a literal circle, or as a linear keyspace? Circles read
  better at low node counts; linear scales better and is easier to label.
- Where does the `% N` comparison live — a toggle on one ring, or two rings
  side by side?
- At what key count does individual rendering hand off to aggregated arcs, and
  is that switch visible to the viewer or silent?

## Changes from v1

**Kept as written** — these were right:

- Runs generated instantly, played back at a watchable rate. This resolved the
  "seek into the future" problem correctly and independently.
- Latency NFR now names its operation ("generation of the run").
- Scale bound added (10⁵).
- Hash function's required property identified as uniform distribution.
- Virtual nodes described as placeholders rather than real nodes.
- Reader added as a third user.
- FRs now name domain entities (nodes, keys, virtual nodes).

**Overridden:**

- Entities pruned — Connections, LB/client node types, and Event removed.
  v1 *added* the missing domain entities but did not *remove* the ones that
  don't belong; both halves are needed.
- "Each node/key occupies 1 space on the ring" corrected — nodes occupy V
  positions, keys occupy none.
- Seek latency tightened from 100ms to 16ms (drag, not click).
- Render bound (N4) added — 10⁵ is a compute limit, not a render limit.
- Keys declared **accumulating**, resolving the consume-vs-remap contradiction.
- Determinism reopened — it conflicts with the seek requirement.
