# Committed Event Logs

JSON event logs recorded from real runs of the Go programs (and, later,
notable simulation runs). The site's replay visualizer loads these files and
lets visitors scrub through them.

- Format: [schema.md](./schema.md) (v0)
- Example: [example-ping.json](./example-ping.json)
- Convention: one run per file, `<program>-<scenario>.json`
  (e.g. `lsm-crash-recovery-10k.json`, `raft-leader-election-partition.json`)

Only commit logs worth replaying — interesting failures, clean demonstrations
of a concept, capstone runs. This is a curated gallery, not a dumping ground.
