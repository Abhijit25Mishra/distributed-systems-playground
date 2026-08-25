/**
 * AGENT-OWNED — the whole model for the latency percentiles explorer.
 *
 * Written by the agent including the algorithm, which is a deliberate
 * exception to the hand-written boundary in CLAUDE.md. The human read the
 * concept, judged there was nothing in it they needed to build by hand, and
 * asked for it to be built completely (2026-08-25). The boundary still holds
 * everywhere else.
 *
 * The claim the figure exists to support is DDIA Ch 2's: a slow tail that
 * affects one request in a hundred affects far more than one page in a
 * hundred, because a page is only as fast as the slowest call it waits on.
 */

import { createRng } from './rng'

/** Latency in milliseconds. */
export type Millis = number

export interface LatencyParams {
  /** p99 of a single backend call. The tail control. */
  readonly callP99: Millis
  /** Backend calls one page issues in parallel and waits for. */
  readonly fanOut: number
  /** Pages simulated. */
  readonly pageCount: number
  readonly seed: number
}

export interface Percentiles {
  readonly p50: Millis
  readonly p90: Millis
  readonly p99: Millis
}

export interface LatencyModel {
  /** Every individual backend call, sorted ascending. */
  readonly callLatencies: readonly Millis[]
  /** Each page's latency, which is the slowest of its calls. Sorted. */
  readonly pageLatencies: readonly Millis[]
  readonly callPercentiles: Percentiles
  readonly pagePercentiles: Percentiles
  /**
   * The line everything is measured against: the p99 of a single call, so by
   * construction 1% of calls are slower than it.
   */
  readonly threshold: Millis
  /** Fraction of calls slower than the threshold. Always about 0.01. */
  readonly callExceedRate: number
  /** Fraction of pages slower than it. This is the number that surprises. */
  readonly pageExceedRate: number
  /**
   * The first few pages' individual call latencies, unsorted, for the
   * inspector row to cycle through.
   *
   * Held rather than regenerated so cycling costs nothing, and taken from the
   * same pass as everything else so the page being inspected is genuinely one
   * of the pages in the distribution drawn beneath it. Generating a fresh
   * "example" page from its own stream would be statistically identical and
   * still wrong, in exactly the way twelve invented keys were wrong on the
   * ring: the example has to be a member of the population it illustrates.
   */
  readonly inspectablePages: readonly (readonly Millis[])[]
}

/**
 * Median latency of one backend call, held fixed.
 *
 * Fixing it is what makes the tail control mean something. If both the middle
 * and the tail moved, sliding the tail up would just look like "everything got
 * slower", and the point is that the middle can be healthy while the tail is
 * not. A service whose median is 100ms and whose p99 is 2s looks fine on a
 * dashboard showing averages.
 */
export const MEDIAN_CALL_MS = 100

/** z-score at the 99th percentile of a standard normal. */
const Z_P99 = 2.3263478740408408

export const MAX_INSPECTED_CALLS = 220

/** How many pages the inspector can cycle through. */
export const INSPECTABLE_PAGES = 24

/**
 * Latencies are log-normal.
 *
 * Response times cannot be negative, cluster around a typical value, and have
 * a long right tail from queueing, retries, GC pauses and cold caches. That is
 * the shape a log-normal has, and it is the standard first model for service
 * latency. A normal distribution would be wrong in a way that matters here: it
 * is symmetric, so it has no tail to amplify, and the entire lesson would
 * vanish.
 */
function sigmaFor(p99: Millis): number {
  return Math.max(0, (Math.log(p99) - Math.log(MEDIAN_CALL_MS)) / Z_P99)
}

/**
 * Percentile by linear interpolation between order statistics.
 *
 * `sorted` must already be ascending. The alternative, nearest-rank, jumps in
 * visible steps when the sample is small, which would read as the figure
 * glitching while the sample-size slider moves rather than as the estimate
 * being coarse.
 */
export function percentile(sorted: readonly Millis[], fraction: number): Millis {
  if (sorted.length === 0) {
    return 0
  }

  if (sorted.length === 1) {
    return sorted[0] ?? 0
  }

  const position = Math.min(Math.max(fraction, 0), 1) * (sorted.length - 1)
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  const low = sorted[lower] ?? 0
  const high = sorted[upper] ?? low

  return low + (high - low) * (position - lower)
}

function percentilesOf(sorted: readonly Millis[]): Percentiles {
  return {
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p99: percentile(sorted, 0.99),
  }
}

/** Fraction of `sorted` strictly greater than `value`, by binary search. */
export function fractionAbove(sorted: readonly Millis[], value: Millis): number {
  if (sorted.length === 0) {
    return 0
  }

  let low = 0
  let high = sorted.length

  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if ((sorted[middle] ?? 0) <= value) {
      low = middle + 1
    } else {
      high = middle
    }
  }

  return (sorted.length - low) / sorted.length
}

/**
 * Theoretical share of pages exceeding a threshold that a single call exceeds
 * with probability `p`, given `fanOut` independent calls: 1 - (1 - p)^k.
 *
 * Carried alongside the measured figure so the two can be shown together. When
 * they disagree, the sample is too small, which is a thing worth being able to
 * see rather than a thing to hide.
 */
export function amplification(p: number, fanOut: number): number {
  return 1 - (1 - p) ** Math.max(0, fanOut)
}

export function buildLatencyModel(params: LatencyParams): LatencyModel {
  const rng = createRng(params.seed)
  const sigma = sigmaFor(params.callP99)
  const fanOut = Math.max(1, Math.round(params.fanOut))
  const pageCount = Math.max(1, Math.round(params.pageCount))

  const callLatencies: Millis[] = []
  const pageLatencies: Millis[] = []
  const inspectablePages: Millis[][] = []

  for (let page = 0; page < pageCount; page += 1) {
    let slowest = 0
    const inspected: Millis[] | undefined = page < INSPECTABLE_PAGES ? [] : undefined

    for (let call = 0; call < fanOut; call += 1) {
      const latency = MEDIAN_CALL_MS * Math.exp(sigma * rng.normal())
      callLatencies.push(latency)

      if (latency > slowest) {
        slowest = latency
      }

      if (inspected && call < MAX_INSPECTED_CALLS) {
        inspected.push(latency)
      }
    }

    if (inspected) {
      inspectablePages.push(inspected)
    }

    pageLatencies.push(slowest)
  }

  callLatencies.sort((a, b) => a - b)
  pageLatencies.sort((a, b) => a - b)

  const callPercentiles = percentilesOf(callLatencies)
  const threshold = callPercentiles.p99

  return {
    callLatencies,
    pageLatencies,
    callPercentiles,
    pagePercentiles: percentilesOf(pageLatencies),
    threshold,
    callExceedRate: fractionAbove(callLatencies, threshold),
    pageExceedRate: fractionAbove(pageLatencies, threshold),
    inspectablePages,
  }
}

/** Milliseconds under a second, then seconds. Two significant-ish digits. */
export function formatLatency(ms: Millis): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`
}
