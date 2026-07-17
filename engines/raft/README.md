# Raft-backed KV Store

Placeholder — work starts December 2026, after the Gossip Glomers sequence.

Plan: hand-written Raft (leader election, log replication, snapshotting) with
a KV store on top, instrumented to emit JSON event logs for the site's replay
visualizer (the February 2027 capstone).

**Hand-written boundary: the human writes Raft. Agents write tests, docs, and
the replay tooling.**
