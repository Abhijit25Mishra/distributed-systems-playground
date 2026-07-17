/**
 * HAND-WRITTEN BOUNDARY — read before touching this folder.
 *
 * These are interface stubs ONLY. The implementations are written BY HAND by
 * the human as a learning exercise. AI agents must never fill these in.
 * Agents may: add tests against these interfaces, consume them from
 * renderers/UI, and refactor call sites — but the engine logic itself is
 * off-limits.
 *
 * THE CONTRACT (what the human will implement):
 * - Discrete-event simulation: pop the earliest event from the queue,
 *   advance the virtual clock to that event's time, execute it (which may
 *   schedule further events), repeat until the queue is empty or a step
 *   limit is hit.
 * - ONE seeded RNG for the entire simulation. Every source of randomness
 *   (latency samples, drop decisions, tie-breaking) draws from it. Given the
 *   same seed and same scenario, a run is byte-identical — this is what makes
 *   scenario URLs shareable and replays trustworthy.
 * - The MessageBus is the only way nodes talk. It applies a configurable
 *   latency distribution, drop rate, and active partitions before delivering.
 */

import type { EventLog, LogEvent } from './eventLog'

/**
 * Deterministic pseudo-random number generator seeded once per run.
 * TODO(human): implement (suggestion: mulberry32 or xoshiro — small, fast,
 * good enough for simulation; do NOT use Math.random anywhere in the engine).
 */
export interface SeededRng {
  /** The seed this generator was created with. */
  readonly seed: number
  /** Next float in [0, 1). Advances internal state. */
  next(): number
  /** Next integer in [min, max] inclusive. Advances internal state. */
  nextInt(min: number, max: number): number
}

/**
 * Virtual simulation clock. Time only moves when the engine advances it to
 * the timestamp of the event being executed — never from wall-clock time.
 * TODO(human): implement.
 */
export interface VirtualClock {
  /** Current virtual time in abstract ticks. */
  now(): number
  /** Advance to a later time. Must throw if `time` is in the past. */
  advanceTo(time: number): void
}

/** An event scheduled to fire at a virtual time. */
export interface ScheduledEvent {
  /** Virtual time at which this event fires. */
  time: number
  /** Insertion sequence — tie-breaker so same-time events pop in FIFO order. */
  sequence: number
  execute(): void
}

/**
 * Priority queue ordered by (time, sequence).
 * TODO(human): implement (binary heap, or sorted array to start — measure later).
 */
export interface EventQueue {
  push(event: ScheduledEvent): void
  /** Remove and return the earliest event, or undefined when empty. */
  pop(): ScheduledEvent | undefined
  readonly size: number
}

/** How message latency is sampled, using the single engine RNG. */
export interface LatencyDistribution {
  kind: 'fixed' | 'uniform' | 'exponential'
  /** fixed: the latency. uniform: lower bound. exponential: mean. */
  min: number
  /** uniform: upper bound. Unused for other kinds. */
  max?: number
}

export interface MessageBusConfig {
  latency: LatencyDistribution
  /** Probability in [0, 1] that any given message is silently dropped. */
  dropRate: number
  /**
   * Active partitions: each entry is a group of nodeIds that can reach each
   * other. Messages across group boundaries are dropped. Empty array = fully
   * connected network.
   */
  partitions: string[][]
}

export interface Message {
  from: string
  to: string
  body: Record<string, unknown>
}

/**
 * The only communication path between nodes. Applies latency, drops, and
 * partitions — all randomness drawn from the engine's single SeededRng.
 * TODO(human): implement.
 */
export interface MessageBus {
  readonly config: MessageBusConfig
  /** Queue a message; delivery is scheduled on the engine's event queue. */
  send(message: Message): void
  /** Replace network conditions mid-run (e.g. user toggles a partition). */
  reconfigure(config: MessageBusConfig): void
}

/** A participant in the simulation (a "process" in DDIA terms). */
export interface SimNode {
  readonly id: string
  /** Called by the bus when a message survives latency/drops/partitions. */
  onMessage(message: Message, engine: SimEngine): void
}

export interface SimConfig {
  seed: number
  bus: MessageBusConfig
  /** Safety valve: stop after this many executed events. */
  maxSteps: number
}

/**
 * The deterministic discrete-event simulation engine (layer L1).
 * Concept modules (L2) schedule work on it; renderers (L3) subscribe to the
 * event log it produces.
 * TODO(human): implement in engine.ts and wire createSimEngine to it.
 */
export interface SimEngine {
  readonly clock: VirtualClock
  readonly rng: SeededRng
  readonly bus: MessageBus
  addNode(node: SimNode): void
  /** Schedule a callback at an absolute virtual time. */
  schedule(time: number, execute: () => void): void
  /** Run until the queue is empty or maxSteps executed. */
  run(): void
  /** Execute exactly one event (for step-through UI). Returns false when queue empty. */
  step(): boolean
  /** Record a custom entry into the run's event log. */
  emit(event: LogEvent): void
  /** The full log of everything that happened, in execution order. */
  getEventLog(): EventLog
}
