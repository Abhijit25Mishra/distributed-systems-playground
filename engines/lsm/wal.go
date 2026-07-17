package main

// TODO(human): write-ahead log.
// Contract: Append(record) must fsync (or at least flush) before returning,
// so an acknowledged write survives kill -9. Replay(dir) rebuilds the
// memtable on startup. Design the on-disk record format yourself — length
// prefix + checksum is the classic starting point.

type wal struct{}
