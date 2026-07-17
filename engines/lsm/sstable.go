package main

// TODO(human): immutable sorted table on disk.
// Part 1: write a full memtable out as sorted key/value pairs plus a sparse
// index; Get scans newest table to oldest. Part 2: compaction merges tables
// and drops shadowed values/tombstones; a bloom filter per table lets Get
// skip tables that definitely lack the key.

type sstable struct{}
