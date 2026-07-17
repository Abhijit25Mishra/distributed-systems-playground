# Event Log Schema — v0

The JSON event log is the **only contract** between the Go programs and the
website. Go programs record runs; the site's replay visualizer loads and
animates them. Keep this format language-agnostic and boring.

Mirrors: `site/src/engine/eventLog.ts` (TypeScript) and the struct block in
`engines/lsm/doc.go` (Go). Change one, change all three.

## Shape

```json
{
  "meta": {
    "name": "string — human-readable run name",
    "seed": 0,
    "timestamp": "ISO-8601 string — when the run was recorded"
  },
  "events": [
    {
      "tick": 0,
      "nodeId": "string — e.g. n1",
      "type": "send | receive | drop | state-change | custom",
      "payload": {}
    }
  ]
}
```

## Rules

- `events` is ordered by execution: `tick` is non-decreasing.
- `tick` is virtual time in simulations; in Go programs it is a monotonic
  sequence number (wall-clock time, if useful, goes in the payload).
- `seed` makes runs reproducible; use `0` when a program has no randomness.
- `payload` is free-form per event type in v0. Structure will be tightened
  per-concept once the replay visualizer exists (schema v1).
- One log = one run = one file, named `<program>-<scenario>.json`.

## Example

See [`example-ping.json`](./example-ping.json) — a two-node ping where one
message is dropped.
