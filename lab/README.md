# Lab

One folder per visualization, outside `site/`. This is where the *thinking*
lives — design docs, learning notes, and throwaway practice code — separate
from the shipped implementation in `site/`.

```
lab/
  hld-method.md   the repeatable procedure for writing a design doc — read
                  this before starting one
  SKILLS.md       running self-assessment across all visualizations
  <concept>/
    README.md     design doc: problem, entities, users, functional,
                  non-functional, API, invariants, definition of done
    notes.md      learning notes while working through it — questions, dead
                  ends, things that surprised you
    scratch/      practice code, throwaway experiments (optional)
```

## The sequence — a design doc is not the last step before code

```
design doc  →  API / data model  →  invariants as failing tests  →  implement
```

Skipping straight from doc to code is the most common way to discover, three
days in, that an entity was missing. See `hld-method.md`.

## Why it's separate from `site/`

`site/` holds the polished, working visualization. `lab/` holds the mess that
produced it: the wrong first model, the parameter you didn't realise mattered,
the property test that caught a bug. That mess is the actual learning record,
and it is worth keeping — but it should not clutter the shipped code.

## Conventions

- **Write the design doc before the code.** It is cheap to notice a missing
  entity on paper and expensive to notice it after the renderer is built.
- **The doc is a living file.** When an assumption turns out wrong, edit it and
  note what changed — don't quietly fix it.
- **`notes.md` is for the "why", not the "what".** The code shows what you
  built. Notes should capture what confused you and what you'd do differently.
- **End of a session, findings go to `journal/`.** `lab/` is per-concept and
  permanent; `journal/` is chronological. A finding worth keeping usually
  belongs in both.
