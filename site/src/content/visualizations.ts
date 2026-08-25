/**
 * AGENT-OWNED — the site's catalogue.
 *
 * Slugs are load-bearing: they are already routed and already linkable, so
 * they do not change. Everything else here is presentation metadata read off
 * PLAN.md.
 *
 * Ordering is by planned ship date, not by topic. That turns the index into a
 * timeline, which is information the visitor did not have before.
 */

export type VisualizationStatus = 'live' | 'building' | 'planned'

export interface Visualization {
  /** Route segment. Stable, never renamed. */
  readonly slug: string
  /** Position in the index, zero-padded on display. */
  readonly ordinal: number
  readonly title: string
  /** One line for the index row. Lowercase, no terminal period. */
  readonly summary: string
  /** What the reader should walk away understanding. Shown on the page. */
  readonly concept: string
  readonly status: VisualizationStatus
  /** Item number in PLAN.md, so the site and the plan stay traceable. */
  readonly planItem: number
  /** DDIA chapter this belongs to. */
  readonly chapter: string
  /** Planned ship window, as written in PLAN.md. */
  readonly eta: string
}

export const VISUALIZATIONS: readonly Visualization[] = [
  {
    slug: 'consistent-hashing',
    ordinal: 1,
    title: 'Consistent Hashing Ring',
    summary: 'keys remap as nodes join and leave the ring',
    concept:
      'Why adding a node to a hash-partitioned cluster moves 1/n of the keys instead of nearly all of them, and what virtual nodes actually buy you.',
    status: 'live',
    planItem: 1,
    chapter: 'Ch 7 - Sharding',
    eta: 'Aug 2026',
  },
  {
    slug: 'latency-percentiles',
    ordinal: 2,
    title: 'Latency Percentiles Explorer',
    summary: 'why p99 matters more than the mean, fan-out amplification included',
    concept:
      'How a tail latency that affects one request in a hundred ends up affecting most users once a single page fans out to dozens of backend calls.',
    status: 'live',
    planItem: 3,
    chapter: 'Ch 2 - Nonfunctional Requirements',
    eta: 'Aug 2026',
  },
  {
    slug: 'lsm-lifecycle',
    ordinal: 3,
    title: 'LSM Lifecycle Animation',
    summary: 'memtable fills, WAL grows, SSTables flush and compact',
    concept:
      'The full write path of a log-structured merge tree, replayed from an event log recorded by the real Go engine rather than simulated in the browser.',
    status: 'planned',
    planItem: 7,
    chapter: 'Ch 4 - Storage and Retrieval',
    eta: 'Oct 2026',
  },
  {
    slug: 'replication-lag',
    ordinal: 4,
    title: 'Replication Lag Simulator',
    summary: 'read-your-writes and monotonic-read violations, on demand',
    concept:
      'Why asynchronous replication lets a user write a comment and then not see it, and which consistency guarantee each fix actually buys.',
    status: 'planned',
    planItem: 10,
    chapter: 'Ch 6 - Replication',
    eta: 'Nov 2026',
  },
  {
    slug: 'quorum',
    ordinal: 5,
    title: 'Quorum R/W Explorer',
    summary: 'tune N, R and W, then watch reads go stale',
    concept:
      'Where the w + r > n rule comes from, and the cases where satisfying it still returns a stale value.',
    status: 'planned',
    planItem: 11,
    chapter: 'Ch 6 - Replication',
    eta: 'Nov 2026',
  },
  {
    slug: 'sharding-hotspots',
    ordinal: 6,
    title: 'Hash vs Range Sharding Hot Spots',
    summary: 'how partitioning strategy shapes load skew',
    concept:
      'Why range partitioning gives you efficient scans and a hot shard, hash partitioning gives you even load and no scans, and what compound keys recover.',
    status: 'planned',
    planItem: 12,
    chapter: 'Ch 7 - Sharding',
    eta: 'Dec 2026',
  },
  {
    slug: 'isolation-levels',
    ordinal: 7,
    title: 'Transaction Isolation Playground',
    summary: 'trigger dirty reads, lost updates and write skew by hand',
    concept:
      'Each isolation level defined by the anomaly it prevents, driven by interleaving two transactions yourself rather than reading a table of guarantees.',
    status: 'planned',
    planItem: 13,
    chapter: 'Ch 8 - Transactions',
    eta: 'Dec 2026',
  },
  {
    slug: 'two-phase-commit',
    ordinal: 8,
    title: '2PC Coordinator Crash',
    summary: 'kill the coordinator mid-commit and watch participants block',
    concept:
      'Why two-phase commit is a blocking protocol, and what in-doubt participants can and cannot do once the coordinator is gone.',
    status: 'planned',
    planItem: 14,
    chapter: 'Ch 8 - Transactions',
    eta: 'Dec 2026',
  },
  {
    slug: 'unreliable-network',
    ordinal: 9,
    title: 'Unreliable Network Playground',
    summary: 'delays, drops and partitions, the default state of the network',
    concept:
      'Why a timeout cannot distinguish a dead node from a slow one, and what every higher-level protocol has to build on top of that ambiguity.',
    status: 'planned',
    planItem: 15,
    chapter: 'Ch 9 - Trouble with Distributed Systems',
    eta: '2027',
  },
  {
    slug: 'vector-clocks',
    ordinal: 10,
    title: 'Vector Clocks',
    summary: 'causality tracking and concurrent-write detection, step by step',
    concept:
      'How happens-before is tracked without a shared clock, and what it means for two writes to be genuinely concurrent rather than merely unordered.',
    status: 'planned',
    planItem: 16,
    chapter: 'Ch 10 - Consistency and Consensus',
    eta: '2027',
  },
  {
    slug: 'replay',
    ordinal: 11,
    title: 'Raft Replay Visualizer',
    summary: 'scrub through event logs recorded from real Go programs',
    concept:
      'Leader election and log replication, replayed from a JSON event log emitted by a Raft implementation that actually ran over a network.',
    status: 'planned',
    planItem: 21,
    chapter: 'Ch 10 - Consistency and Consensus',
    eta: '2027',
  },
]

export const STATUS_LABEL: Record<VisualizationStatus, string> = {
  live: 'live',
  building: 'building',
  planned: 'planned',
}

export function findVisualization(slug: string): Visualization | undefined {
  return VISUALIZATIONS.find((visualization) => visualization.slug === slug)
}

/** The one the homepage puts a live figure at the top of. */
export function featuredVisualization(): Visualization {
  const inProgress = VISUALIZATIONS.find(
    (visualization) => visualization.status === 'building' || visualization.status === 'live',
  )

  // The catalogue is never empty, but the type system does not know that and
  // an index-out-of-bounds here would blank the homepage.
  const fallback = VISUALIZATIONS[0]

  if (!inProgress && !fallback) {
    throw new Error('VISUALIZATIONS is empty — the homepage has nothing to feature')
  }

  return inProgress ?? (fallback as Visualization)
}

export function countByStatus(status: VisualizationStatus): number {
  return VISUALIZATIONS.filter((visualization) => visualization.status === status).length
}
