/**
 * AGENT-OWNED — chapter deadlines mirrored from PLAN.md § List 2.
 *
 * This is a mirror, and mirrors drift. It is small and changes a handful of
 * times a year, so hand-syncing is cheaper than a build step; if it ever
 * starts disagreeing with PLAN.md, generate it instead of copying it.
 */

export type ChapterState = 'done' | 'reading' | 'upcoming'

export interface Chapter {
  readonly number: number
  readonly title: string
  /** As written in PLAN.md. Absolute dates, never "next month". */
  readonly deadline: string
  readonly state: ChapterState
  /** Chapters 10-14 sit in the slow lane with softer targets. */
  readonly lane: 'core' | 'slow'
  readonly stretch?: boolean
}

export const CHAPTERS: readonly Chapter[] = [
  {
    number: 1,
    title: 'Trade-Offs in Data Systems Architecture',
    deadline: 'done',
    state: 'done',
    lane: 'core',
  },
  {
    number: 2,
    title: 'Defining Nonfunctional Requirements',
    deadline: 'Aug 24, 2026',
    state: 'reading',
    lane: 'core',
  },
  {
    number: 3,
    title: 'Data Models and Query Languages',
    deadline: 'Sep 7, 2026',
    state: 'upcoming',
    lane: 'core',
  },
  {
    number: 4,
    title: 'Storage and Retrieval',
    deadline: 'Sep 30, 2026',
    state: 'upcoming',
    lane: 'core',
  },
  {
    number: 5,
    title: 'Encoding and Evolution',
    deadline: 'Oct 19, 2026',
    state: 'upcoming',
    lane: 'core',
  },
  { number: 6, title: 'Replication', deadline: 'Nov 16, 2026', state: 'upcoming', lane: 'core' },
  { number: 7, title: 'Sharding', deadline: 'Nov 30, 2026', state: 'upcoming', lane: 'core' },
  { number: 8, title: 'Transactions', deadline: 'Dec 21, 2026', state: 'upcoming', lane: 'core' },
  {
    number: 9,
    title: 'The Trouble with Distributed Systems',
    deadline: 'Dec 31, 2026',
    state: 'upcoming',
    lane: 'core',
    stretch: true,
  },
  {
    number: 10,
    title: 'Consistency and Consensus',
    deadline: 'Feb 2027',
    state: 'upcoming',
    lane: 'slow',
  },
  { number: 11, title: 'Batch Processing', deadline: 'Mar 2027', state: 'upcoming', lane: 'slow' },
  { number: 12, title: 'Stream Processing', deadline: 'Apr 2027', state: 'upcoming', lane: 'slow' },
  {
    number: 13,
    title: 'A Philosophy of Streaming Systems',
    deadline: 'May 2027',
    state: 'upcoming',
    lane: 'slow',
  },
  { number: 14, title: 'Doing the Right Thing', deadline: 'May 2027', state: 'upcoming', lane: 'slow' },
]

export const CORE_CHAPTERS = CHAPTERS.filter((chapter) => chapter.lane === 'core')
export const SLOW_LANE_CHAPTERS = CHAPTERS.filter((chapter) => chapter.lane === 'slow')

export function currentChapter(): Chapter | undefined {
  return CHAPTERS.find((chapter) => chapter.state === 'reading')
}

export function chaptersDone(): number {
  return CHAPTERS.filter((chapter) => chapter.state === 'done').length
}
