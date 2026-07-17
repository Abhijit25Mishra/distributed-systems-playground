/**
 * Event log schema v0 — the ONLY contract between the Go world and the website.
 * Must stay in sync with /logs/schema.md and the Go struct documented in
 * /engines/lsm/doc.go. Keep language-agnostic: plain JSON, no TS-only tricks.
 */

export type EventType = 'send' | 'receive' | 'drop' | 'state-change' | 'custom'

export interface RunMetadata {
  /** Human-readable run name, e.g. "lsm-crash-recovery-10k". */
  name: string
  /** Seed the run was executed with. Same seed => byte-identical run. */
  seed: number
  /** ISO-8601 wall-clock timestamp of when the run was recorded. */
  timestamp: string
}

export interface LogEvent {
  /** Virtual time (simulation) or monotonic sequence number (Go programs). */
  tick: number
  /** Which node this event happened on, e.g. "n1". */
  nodeId: string
  type: EventType
  /** Event-type-specific data. Schema deliberately open for v0. */
  payload: Record<string, unknown>
}

export interface EventLog {
  meta: RunMetadata
  events: LogEvent[]
}
