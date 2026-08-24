# Journal

One file per working day: `YYYY-MM-DD.md`. Only write an entry on days work
actually happened — there is no value in filler.

This is the project's memory. The repo records *what* was built; the journal
records *why*, *what was learned*, and *what went wrong*. Six months from now
the code will be self-explanatory and the reasoning will not be.

## Before starting anything new

Read the last 2–3 entries first. Look for: decisions already made (don't
re-litigate), findings that change the approach, and mistakes worth not
repeating. This is mandatory for both the human and any AI agent — see
`../CLAUDE.md`.

## Template

```markdown
# YYYY-MM-DD — <one-line title>

**DDIA:** <chapter + status>
**Plan items:** <numbers from PLAN.md, or "none — detour">

## What I did

## Findings
<Technical discoveries worth keeping. Include measured numbers, not
impressions. If something was verified, say how.>

## What I got wrong / missed
<Honest. Wrong assumptions, premature decisions, wasted effort, things
noticed too late. This section is the reason the journal exists.>

## Next
```

## Rules

- **Measured over remembered.** If an entry claims a number, it came from
  running something. Say what was run.
- **Record the dead ends too.** An approach that failed and why is worth more
  later than a clean summary of what worked.
- **"What I got wrong" is not optional.** If it is empty, the entry is
  probably not honest yet.
- Entries are append-only in spirit — correct a later entry, don't rewrite
  history in an old one.
