# HLD method — a repeatable procedure

Reference for every `lab/<concept>/README.md`, and for interview prep later.
The order matters: each step feeds the next, and doing them out of order is
what produces a doc that describes the wrong system.

```
Problem  →  Entities  →  Functional  →  Non-functional  →  API  →  Invariants  →  DoD
             ↑______________↕______________↑
              these cross-check each other
```

---

## Step 1 — Problem statement

One or two sentences. Then immediately write **what this is NOT**, because
scope creep enters here and nowhere else.

> For consistent hashing: it is a *mapping function*. It is not a network
> simulator, not a replication system, not a load balancer.

## Step 2 — Entities

**Entities are what the algorithm reads and writes. They are domain nouns, not
UI nouns and not infrastructure nouns.**

Three tools for finding them:

**a) Write the core function signature first.** The entities fall out of it.

```
lookup(key, ring) -> node
```

Three entities, immediately: `Key`, `Ring`, `Node`. If you cannot write this
signature, you do not understand the problem well enough to list entities yet.

**b) The deletion test.** For each candidate entity, ask: *if I delete this,
is the system still the thing it claims to be?*

| Candidate | Delete it → | Verdict |
|---|---|---|
| Key | nothing left to map | **core** |
| Ring | no consistent hashing | **core** |
| Node | nothing to map to | **core** |
| Virtual node | still works, just skewed | **core parameter** |
| Connection | works fine | ❌ not an entity here |
| LB node | works fine | ❌ borrowed from another problem |

**c) Distinguish the three kinds of noun.** Beginners mix these:

- **Domain entities** — what the algorithm manipulates (Key, Ring, Node)
- **Interaction objects** — what the *user* manipulates (Scenario, Run, Parameter)
- **Infrastructure** — how it's delivered (Connection, Server, Canvas)

Only the first group belongs in Entities. The second group belongs in the API
section. The third usually belongs nowhere.

## Step 3 — Functional requirements

What the system **does**. Derivable from the problem statement, which is why
these feel easier — but there is one trap.

**Every FR must name at least one domain entity.** This is the cross-check
that catches missing entities:

- ✅ "Operator can add or remove a **node**" — names Node
- ✅ "Operator can look up which **node** owns a **key**" — names Node, Key
- ❌ "Users can run the algorithm and observe the trace" — names nothing;
  true of literally any system

Run the list both ways: every FR names an entity, **and every entity appears
in some FR**. An entity with no FR is dead weight. An FR naming no entity is
too vague to build.

**Then add the requirement that carries the lesson.** For a teaching
visualization, ask: *what must the viewer see to understand why this algorithm
exists?* For consistent hashing that is the `hash % N` comparison. Without it
the page shows a mechanism and never explains the motivation.

## Step 4 — Non-functional requirements

**The question NFRs answer: "what would make this unusable even if it were
100% functionally correct?"**

Two rules:

1. **Every NFR needs a number AND a reason.** "Should be fast" is not an NFR.
   `<100ms per seek, because dragging a scrubber must feel instant` is.
2. **Derive them from your users.** Walk each user through their loop and ask
   what would ruin it. The Operator drags a slider → latency budget. The
   Operator compares runs → memory budget. That traceability is what makes a
   number defensible instead of arbitrary.

Run this checklist every time — most categories will be "n/a", and saying so
explicitly is worth more than silence:

| Category | Ask |
|---|---|
| **Latency** | Which interaction, and what human threshold? (100ms instant · 1s responsive · 10s attention lost) |
| **Scale** | Bounds on every input. How many nodes? keys? runs? |
| **Memory** | What dominates it, and what is the budget? |
| **Correctness** | What must *never* be wrong, even under load? |
| **Durability** | Does anything survive reload? Should it? |
| **Determinism** | Same inputs → same output? Is a run shareable/reproducible? |
| **Availability** | n/a for a static site |
| **Security** | n/a when there's no backend or user data |
| **Cost** | n/a when compute is the visitor's CPU |
| **Usability** | Does the Reader understand it without touching a control? |

**Name the operation.** "Sub-100ms" is half an NFR — 100ms of *what*? Compute?
Seek? Frame render? These have different budgets and different solutions, and
picking the wrong one sends you optimizing the wrong thing.

## Step 5 — API / data model

The bridge from prose to code, and in an interview this is usually where the
most points are. Turn entities into concrete types and operations:

```
Ring:   addNode(nodeId, virtualNodes) · removeNode(nodeId) · lookup(key) -> nodeId
Run:    apply(operation) · stateAt(index) · diff(indexA, indexB)
```

If a type or an operation has no FR behind it, cut it. If an FR has no
operation, the API is incomplete.

## Step 6 — Invariants

Properties that must hold, written as claims that **could fail**. These become
your tests directly. "The animation looks right" is not an invariant; "removing
node X relocates only keys previously owned by X" is.

Good invariants are: falsifiable, checkable in code, and independent of the UI.

## Step 7 — Definition of done

One concrete, falsifiable scenario. A test could run it and report pass/fail.

> Model: *"Write 10k keys, kill -9 mid-write, restart, read every acknowledged
> key back correctly."*

Not: *"the visualization works well."*

---

## The two most common first-timer mistakes

1. **Modelling the UI instead of the domain.** Symptom: entities are things you
   can see on screen (connections, panels, canvases) rather than things the
   algorithm operates on. Fix: write the core function signature first.
2. **Generalising on problem #1.** Symptom: the doc would read identically for
   a different algorithm. Fix: after writing it, swap the algorithm name in
   your head — if nothing else needs to change, the doc has no content yet.
