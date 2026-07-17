package main

// TODO(human): in-memory sorted structure for recent writes.
// Needs ordered iteration for SSTable flush. Options: sorted slice (simple),
// skip list (the classic), or a red-black tree. Deletes are tombstones, not
// removals — a tombstone must shadow older values in SSTables.

type memtable struct{}
