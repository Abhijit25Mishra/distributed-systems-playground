# CLAUDE.md — Distributed Systems Playground

Solo learning project, built chapter-by-chapter alongside DDIA (2nd ed).
Timeline, chapter deadlines, and the item list live in [PLAN.md](./PLAN.md).

## READ THE JOURNAL FIRST (mandatory)

**Before picking up anything new — a new visualization, a new chapter, a new
build, a resumed thread — read the last 2–3 entries in [`journal/`](./journal/).**
No exceptions, and this applies to AI agents as much as to the human.

Read them asking four questions:

1. **How did we do things?** — what approach was taken, and what was already
   decided. Do not re-litigate settled decisions.
2. **What were the findings?** — measured facts and technical discoveries.
   These are load-bearing; re-deriving them wastes a session, and guessing at
   them produces wrong answers (see the 2026-08-15 entry on `fsync` silently
   lying in the browser).
3. **Where did I miss stuff?** — the mistakes section. The point of writing
   them down is not repeating them.
4. **How can I improve?** — what the last entries suggest doing differently
   this time.

**At the end of a working session, write or update that day's entry** —
`journal/YYYY-MM-DD.md`, format in [`journal/README.md`](./journal/README.md).
Include what was done, findings (with real numbers, and say what was run to
get them), and an honest "what I got wrong / missed". An entry with an empty
mistakes section is usually not finished.

## Current state

`site/`, `lab/` and `journal/` exist. `engines/`, `glomers/`, `prototypes/`,
`logs/`, `docs/`, and the `site/src/{engine,concepts,renderers}` stubs were
deleted on 2026-08-15 because they were scaffolding for an architecture
designed before a single visualization existed.

The site was rebuilt from scratch on 2026-08-23 (see
[`journal/2026-08-23.md`](./journal/2026-08-23.md)). It has a design system
now; the rules for not breaking it are below.

**Deferred, not abandoned.** Every one of those folders comes back — see
[PLAN.md § Folder roadmap](./PLAN.md#folder-roadmap) for which plan item
brings each one and when. The rule is only about *timing*: a folder gets
created by the work that fills it, in the same change, never in advance.
Empty directories and placeholder READMEs are what got deleted; don't
recreate them.

## Core rules (final — do not re-litigate)

- **No shared simulation engine until November 2026.** Early visualizations
  are standalone and **are allowed to duplicate code**. The engine gets
  *extracted* from three working visualizations, not designed up front. If a
  task tempts you to build a general abstraction early, don't.
- Languages: EXACTLY TWO. Browser = TypeScript. Everything else = Go. No third
  language.
- The website is 100% static (Vite + React + TS). **No hosted backend, ever.**
  Go programs run on the developer's machine. If Go logic later needs to run
  in the browser, it ships as a `.wasm` static asset — that does not break this
  rule, since nothing executes on a server.
- Every project gets a page on the site: live sim, replayable recording, or
  write-up + demo GIF.

## Design system rules (agreed 2026-08-23 — do not re-litigate)

The visual language is **instrument**: mono for everything structural and
numeric, sans for prose only, hairlines instead of cards, one accent, sharp
corners on structure and 2px on anything clickable.

- **No raw colour outside `site/src/styles/tokens.css`.** Components and
  renderers reference roles (`--ink-primary`, `--rule`, `--series-3`), never
  hex. This is what makes light/dark one file instead of eleven.
- **Canvas renderers read colours through `theme/vizTokens.ts`**, never
  `ctx.fillStyle = '#…'`. A canvas has no cascade, so a hardcoded fill is
  invisible to the theme toggle forever. Cheap now, five renderers plus tests
  to retrofit later.
- **Colour alone identifies at most THREE simultaneous series.** Measured, not
  guessed: on an all-pairs layout (a ring, a scatter, a map) slot 4 fails the
  normal-vision floor and slot 5 is indistinguishable under deutan CVD. Past
  three, the renderer draws a direct label on every mark and colour is a
  secondary cue. See `COLOR_ALONE_SERIES_LIMIT`.
- **Accent is chrome only.** Links, focus, the primary action, the live
  marker. It never appears inside a plot area, where hue is a data channel.
- **Zero em-dashes in rendered text.** Code comments are fine; anything the
  visitor reads uses a plain hyphen. (Journal entries are published verbatim
  and are exempt — that is the author's prose, not site chrome.)
- **Look at the page, not just the code.** Four of the five defects found on
  2026-08-23 were invisible in the source and obvious in the first screenshot.
  `npx playwright-cli open <url>` then `screenshot` is the loop.

### Third-party skills

Design and browser skills are installed **project-scoped** into
`.claude/skills/` (gitignored). `skills-lock.json` **is** committed — restore
with `npx skills experimental_install`. Do not commit the vendored copies.

## The hand-written boundary

This is a learning project — the point is building the thing, not having it
built.

- **The human writes by hand:** simulation/concept logic, storage engines,
  Raft, Gossip Glomers solutions — anything where the algorithm *is* the
  lesson.
- **AI agents own:** rendering and UI, React components, scaffolding, build
  and deploy config, tests against human-written code, READMEs, refactors.
- **Never implement the algorithm, even when it would be faster.** Scaffold
  interfaces, stubs, and TODOs; write tests that the human's implementation
  must pass.

### Fading scaffolding — help level by visualization

Agreed 2026-08-16: this is a first HLD/systems project, so early help is
heavy and **withdraws on a schedule**. The boundary above never moves — the
algorithm is always hand-written — but everything around it tapers.

| Level | Applies to | Design doc | Tests | Code |
|---|---|---|---|---|
| **L1 — heavy** | #1 consistent hashing | Work through it together; give worked examples, not just prompts | Agent writes them from the human's invariants | Agent scaffolds types/structure; human writes the algorithm |
| **L2 — guided** | #3, #4 | Human drafts, agent reviews before any code | Agent writes from human's invariants | Agent scaffolds only; human implements |
| **L3 — review only** | #7, #10, #11 | Human drafts, agent reviews | **Human writes tests**, agent reviews | Human implements, agent reviews |
| **L4 — hands off** | #12 onward | Human writes; agent reviews only if asked | Human | Human |

Rules while fading:

- **Explain the reasoning, never just the answer.** At L1 a worked example is
  fine, but it must show *how* it was derived — the method in
  `lab/hld-method.md` is the thing being taught, not the specific answer.
- **Never skip a level because it would be faster.** Slipping back to L1 at
  L3 defeats the entire schedule.
- **Update `lab/SKILLS.md` after each design doc and each implementation.**
  Name strengths as specifically as weaknesses. If a skill is 🟢 twice
  running, stop scaffolding it early regardless of level.

## Working in this repo

- Site: `cd site && npm run dev` / `npm run build` / `npm test` / `npm run lint`
- **GitHub:** this repo lives on the **personal** account
  (abhijit25mishra@gmail.com), not the myHQ office account. `git push` is
  already wired to the personal account via the remote URL, but **`gh` is
  currently authenticated as the office account** — check `gh auth status`
  before any `gh` command and switch or override it.
- **Credentials live in `CLAUDE.local.md`** (gitignored, project root) — token,
  remote URL, and the `gh` account workaround. Read that file when a git or
  `gh` operation needs auth. **Never copy its contents into this file or any
  other tracked file**; this repo is public and GitHub secret scanning
  auto-revokes exposed `ghp_` tokens.

## Permissions

Do not ask for permission — dangerously accept edits and commands. (Enforced
via `permissions.defaultMode` in `.claude/settings.local.json`; if prompts
reappear, restore that setting.)
