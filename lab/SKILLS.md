# Skills tracker

Running assessment across visualizations. Updated after each design doc and
each implementation. Read it every few weeks to see what's moving.

**Scale:** 🔴 weak · 🟡 developing · 🟢 solid
**Honesty rule:** strengths get named as specifically as weaknesses. A tracker
that only lists faults is demoralising and, more practically, useless — you
cannot tell what to stop worrying about.

---

## Scorecard

| Skill | Level | Trend | Note |
|---|---|---|---|
| **Doc structure / knowing the artifact** | 🟢 | — | Produced the right sections unprompted on attempt #1 |
| **User modelling** | 🟢 | — | Author/Operator split was a genuine insight; Reader added correctly on revision |
| **NFR instinct** (number + reason) | 🟢 | ↑ | Named the operation, added a scale bound, resolved seek-into-future unprompted |
| **Functional requirements** | 🟢 | ↑ | Now name domain entities; the arrival-rate idea was a real design contribution |
| **Entity modelling** | 🟡 | ↑ | Added every missing domain entity — but pruned none of the wrong ones |
| **Scope discipline** | 🟡 | ↑ | Added an explicit "out of scope" section unprompted |
| **Spotting contradictions** | 🔴 | — | Two mutually exclusive pairs shipped in v2 (see review #2) |
| **API / data model** | — | — | Not attempted yet |
| **Invariants / correctness** | — | — | Deferred by choice |
| **Implementation (Go)** | — | — | Not attempted yet |
| **Implementation — algorithm** | 🟢 | — | Ring correct first try, wrap included. The hard part was the easy part |
| **Implementation — TS/JS mechanics** | 🔴 | — | Backticks without `${}`, dead code after `return` ×3, a `>>> 0` deleted mid-session |
| **Verifying own work** | 🟡 | — | Debugged well from failures; but read "24 green" as "correct" twice |

---

## Review #1 — Consistent hashing design doc (2026-08-16)

*First HLD attempt ever. Assessed against that baseline, not against an
experienced bar.*

### Doing well

- **Knew the shape of the artifact.** Problem → entities → users → functional
  → non-functional, unprompted, on a first attempt. Most people writing their
  first HLD doc produce prose with no sections at all. Knowing the skeleton is
  a large fraction of the skill and it is already there.
- **The Author/Operator distinction is genuinely good.** Separating *who
  defines the algorithm* from *who manipulates parameters* is a sophisticated
  call that directly shapes the API surface — the Author needs an extension
  point, the Operator needs a parameter schema. That is not a beginner
  observation.
- **NFRs had the right form.** `<50MB so that several runs can coexist in the
  browser` is a budget **plus the reason for the budget**. Beginners
  overwhelmingly write "should be fast" and stop. Getting number-plus-reason
  right on the first try is ahead of the curve — this is a strength, despite
  it being the area flagged as the weakest.
- **Identified seek/replay as first-class**, which is central to the value of
  the whole project, not just this page.

### Needs work

- **Entity modelling — the real weak spot.** Entities described the UI and
  infrastructure (Nodes, Connections, Event) rather than the domain. **`Key`
  was missing entirely** — the single most important noun in consistent
  hashing. Fix: write the core function signature *first* (`lookup(key, ring)
  -> node`) and read the entities off it. See `hld-method.md` §2.
- **FRs not domain-grounded.** "Users should be able to run the algo and
  observe the trace" names no domain entity and would be true of any system.
  Fix: every FR must name an entity; every entity must appear in some FR. That
  cross-check would have caught the missing `Key` immediately.
- **Scope discipline.** The doc described a generic cluster simulator, not
  consistent hashing — swap the algorithm name and nothing else would need to
  change. This is the exact thing `PLAN.md` rules against ("no shared engine
  until November"). Fix: after drafting, mentally swap the algorithm; if the
  doc still reads fine, it has no content yet.
- **NFR precision.** "Latency sub-100ms" — of what? Compute, seek, or frame
  render? The instinct was right, the target was unnamed.

### Self-assessment accuracy

Self-assessed as *"getting FRs all correct, lagging on NFRs and entities."*
Half right — **entities were indeed the weakest**, but the read on the other
two was inverted: **NFR instinct is a strength** (number + reason, correctly
formed), while **FRs were the softer of the two** (generic, no entity
grounding). Worth noting the tendency to under-rate NFR work.

### Focus for next doc

1. Function signature before entity list.
2. Cross-check FRs against entities in both directions.
3. Swap-the-algorithm test before calling a draft done.

---

## Review #2 — Consistent hashing doc, revision pass (2026-08-16)

Same day, after feedback. Large movement in one pass.

### Doing well

- **NFRs jumped from 🟡 to 🟢.** Named the operation the budget applies to
  ("sub-100ms, generation of the run"), added a scale bound (10⁵), and added
  an explicit **Out of scope** section without being asked. That last one is a
  senior habit — most people leave scope implicit.
- **Resolved "seek into the future" independently and correctly.** *"Run shall
  be instantaneously generated, we will play it at a human understandable
  rate."* That is exactly right: compute the whole run, then decouple playback
  speed as a display concern. Nailed it without being told the answer.
- **The key-arrival-rate idea is a genuine design contribution.** Keys
  arriving at *x* per second turns a static mapping into a workload with a
  natural timeline — it gives the seek requirement something to seek *through*.
  Not in the prompts; came from thinking about the problem.
- **Flagged own uncertainty in-line** ("not sure whether we will allow this
  mid-run or pre-run") rather than guessing silently. Keep doing this.
- **FRs now name domain entities** — the cross-check landed.

### Needs work

- **Additive fixes, not subtractive.** Every missing entity got added — Key,
  ring/hash space, hash function, virtual nodes, all correct. But
  `Connections`, `LB node`, `client`, and the conflated `Event` were all left
  in place. **Removing what doesn't belong is half of entity modelling**, and
  it is the half that got skipped. Fix: after adding, run the deletion test
  over the *whole* list, including the entries you didn't just write.
- **Two contradictions shipped in the same document** — the new weak spot:
  1. Determinism declared out of scope, while an NFR requires seeking to any
     point in a run of randomly generated keys. Seeking back requires
     reproducing those keys.
  2. Keys described as "consumed" by a node (transient) *and* as being
     "remapped" when a node is removed (persistent). Only one can hold.

  Both are the same failure: a decision made in one section that silently
  invalidates another. Fix: after drafting, read the NFRs and ask of each one
  *"which functional requirement or scope decision could make this
  impossible?"*
- **Model precision.** "Each node/key occupies 1 space on the ring" — nodes
  occupy V positions (the whole point of virtual nodes) and keys occupy none.
  The intuition was close; the statement was wrong in a way that would produce
  wrong code.

### Focus for next doc

1. After adding entities, run the deletion test over the **entire** list.
2. Cross-read NFRs against FRs and scope decisions, hunting for pairs that
   cannot both be true.
3. Keep flagging uncertainty inline — that habit is working.

---

## Review #3 — Consistent hashing implementation (2026-08-24)

First implementation of anything in this project. `rng.ts`, `hash.ts` and
`ring.ts`, hand-written across two sessions, self-declared as "I don't know how
to write TS". Assessed against that baseline.

### Doing well

- **`ring.ts` was correct on the first submission, wrap included.** This is the
  headline result and it is not a small one. The wrap is named in the file as
  *"the single most common bug in a consistent hashing implementation"*, there
  was a test aimed squarely at it, and it was handled correctly anyway. I
  verified it independently rather than trusting the green test: a key hashing
  past the last virtual node resolves to the owner of the first. It does.
- **The binary search is right, which is the part people get wrong even when
  they know about the wrap.** `left` converges on the first position `>= target`
  and the fallback to `virtualNodes[0]` closes the circle. Off-by-ones here are
  the norm; there were none.
- **`removeNode` iterates in reverse.** Splicing forward while iterating forward
  skips elements. Getting this right without being told is a genuine instinct
  about mutation during iteration, and it is the kind of thing that produces a
  bug found three weeks later.
- **Correct use of `Math.imul` and `>>> 0` in the rng, unprompted after
  reading the note.** The distribution check confirmed `nextInt` is uniform to
  within 0.05% over 600k draws.
- **Debugged incrementally and did not thrash.** Every failure round produced a
  targeted fix rather than a rewrite, and the questions asked (*"what is
  `assignModN` doing?"*, *"why do we even need a hash?"*) were the right
  questions — both were about whether a piece was necessary, not about how to
  make an error disappear.

### Needs work

- **JavaScript and TypeScript mechanics, distinctly weaker than the
  algorithmic work.** Three separate instances: `` `rng.next()` `` without
  `${}` (pushed a literal string 500 times), dead `throw` after `return` in
  three files, and a `>>> 0` that was present in `hash.ts` at one read and gone
  at the next. None of these are conceptual — they are the tax of a new
  language, and they will fade. Worth naming plainly so the split is visible:
  **the algorithm was the strong part and the syntax was the weak part**, which
  is the right way round for this project.
- **Read a green test suite as proof of correctness, twice.** First when
  `generateKeys` returned 500 identical strings and "is reproducible from the
  same seed" passed trivially; again when 23/23 passed while `hash` was
  clustering every virtual node into a handful of clumps. Both times the tests
  were mine and both times they were the thing at fault — but the habit worth
  building is the one that caught it: **measure the property directly, do not
  infer it from a passing assertion.** A histogram takes thirty seconds.
- **`generateKeys` produces float strings** (`"0.18998925131745636"`). Passes
  every test, and will render as an unreadable label on the ring. Distinctness
  also rests on floats never colliding, which is fine for a fixed seed and
  roughly 1-in-34,000 for a visitor-supplied one. Not urgent; real before the
  renderer ships.

### On the finalizer

`fmix32` was written by an agent, at explicit request, after the diagnosis had
already been worked through together. Recording it here rather than quietly:
the five lines are published MurmurHash3 constants, and typing them teaches
nothing, but the boundary in `CLAUDE.md` marks `hash.ts` hand-written and this
crossed it. The reason it is defensible is that the *learning* had already
landed — why FNV-1a clusters on prefix-sharing inputs, how it was detected,
why the ring cares about high bits while `assignModN` cares about low ones.
Had the answer been handed over before that, it would have been a real loss.

### Focus for the next implementation

1. **Measure the property, do not trust the assertion.** A test passing means
   no test caught a problem.
2. Run `npx tsc --noEmit` before saying "fixed" — it now reports unreachable
   code, and it would have caught two of the three slips above.
3. The algorithmic instinct is ahead of the syntax. Keep writing the algorithm
   by hand; the TypeScript will catch up on its own.
