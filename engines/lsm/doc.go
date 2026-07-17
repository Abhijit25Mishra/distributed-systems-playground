// Package main is a mini LSM-tree storage engine, hand-built as a learning
// exercise while reading DDIA chapter 3.
//
// HAND-WRITTEN BOUNDARY: the human implements everything in this module.
// AI agents may write tests, benchmarks, and docs — never the engine logic.
//
// # Spec
//
// A single-node key-value store with Set/Get/Delete.
//
// Part 1 — durability and reads:
//   - memtable: in-memory sorted structure holding recent writes
//   - WAL: every write is appended to a write-ahead log before the memtable
//     is updated, so a crash never loses acknowledged writes
//   - SSTable flush: when the memtable exceeds a size threshold, write it to
//     disk as an immutable sorted table and start a fresh memtable
//
// Part 2 — read amplification and space:
//   - compaction: merge overlapping SSTables, dropping shadowed values and
//     tombstones
//   - bloom filters: one per SSTable so Get can skip tables that definitely
//     do not contain the key
//
// # Definition of done
//
// Write 10k keys, kill -9 the process mid-write, restart, and read every
// acknowledged key back correctly.
//
// # Event log bridge
//
// Runs emit a JSON event log consumed by the site's replay visualizer.
// The schema (v0, see /logs/schema.md) maps to Go as:
//
//	type RunMetadata struct {
//		Name      string `json:"name"`
//		Seed      int64  `json:"seed"`
//		Timestamp string `json:"timestamp"`
//	}
//
//	type LogEvent struct {
//		Tick    int64          `json:"tick"`
//		NodeID  string         `json:"nodeId"`
//		Type    string         `json:"type"` // send | receive | drop | state-change | custom
//		Payload map[string]any `json:"payload"`
//	}
//
//	type EventLog struct {
//		Meta   RunMetadata `json:"meta"`
//		Events []LogEvent  `json:"events"`
//	}
//
// This struct set is the ONLY contract with the TypeScript side
// (site/src/engine/eventLog.ts). Change one, change both.
package main
