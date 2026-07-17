export type VisualizationStatus = 'coming-soon' | 'live'

export interface Visualization {
  slug: string
  title: string
  description: string
  status: VisualizationStatus
}

export const VISUALIZATIONS: Visualization[] = [
  {
    slug: 'consistent-hashing',
    title: 'Consistent Hashing Ring',
    description: 'Watch keys remap as nodes join and leave the ring.',
    status: 'coming-soon',
  },
  {
    slug: 'latency-percentiles',
    title: 'Latency Percentiles Explorer',
    description: 'Why p99 matters more than the mean — fan-out amplification included.',
    status: 'coming-soon',
  },
  {
    slug: 'replication-lag',
    title: 'Replication Lag Simulator',
    description: 'Leader-follower replication, read-your-writes violations, monotonic reads.',
    status: 'coming-soon',
  },
  {
    slug: 'quorum',
    title: 'Quorum R/W Explorer',
    description: 'Tune N, R, W and see when reads return stale values.',
    status: 'coming-soon',
  },
  {
    slug: 'sharding-hotspots',
    title: 'Hash vs Range Sharding Hot Spots',
    description: 'How partitioning strategy shapes load skew.',
    status: 'coming-soon',
  },
  {
    slug: 'isolation-levels',
    title: 'Transaction Isolation Playground',
    description: 'Dirty reads, lost updates, write skew — trigger each anomaly by hand.',
    status: 'coming-soon',
  },
  {
    slug: 'two-phase-commit',
    title: '2PC Coordinator Crash',
    description: 'Kill the coordinator mid-commit and watch participants block.',
    status: 'coming-soon',
  },
  {
    slug: 'unreliable-network',
    title: 'Unreliable Network Playground',
    description: 'Delays, drops, and partitions — the default state of the network.',
    status: 'coming-soon',
  },
  {
    slug: 'vector-clocks',
    title: 'Vector Clocks',
    description: 'Causality tracking and concurrent-write detection, step by step.',
    status: 'coming-soon',
  },
  {
    slug: 'lsm-lifecycle',
    title: 'LSM Lifecycle Animation',
    description: 'Memtable fills, WAL grows, SSTables flush and compact.',
    status: 'coming-soon',
  },
  {
    slug: 'replay',
    title: 'Replay Visualizer',
    description: 'Scrub through JSON event logs recorded from real Go programs.',
    status: 'coming-soon',
  },
]
