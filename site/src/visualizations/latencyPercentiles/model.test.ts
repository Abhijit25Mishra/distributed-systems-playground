import { describe, expect, it } from 'vitest'
import {
  amplification,
  buildLatencyModel,
  formatLatency,
  fractionAbove,
  MEDIAN_CALL_MS,
  percentile,
} from './model'
import { createRng } from './rng'

const BASE = { callP99: 1000, fanOut: 20, pageCount: 2000, seed: 7 }

describe('percentile', () => {
  it('interpolates between order statistics', () => {
    const sorted = [0, 10, 20, 30, 40]
    expect(percentile(sorted, 0)).toBe(0)
    expect(percentile(sorted, 1)).toBe(40)
    expect(percentile(sorted, 0.5)).toBe(20)
    expect(percentile(sorted, 0.25)).toBe(10)
  })

  it('agrees with a counted rank on a uniform ramp', () => {
    // 1..1000, so the p-th percentile should land near p*1000.
    const sorted = Array.from({ length: 1000 }, (_, i) => i + 1)
    expect(percentile(sorted, 0.5)).toBeCloseTo(500.5, 6)
    expect(percentile(sorted, 0.9)).toBeCloseTo(900.1, 6)
    expect(percentile(sorted, 0.99)).toBeCloseTo(990.01, 6)
  })

  it('survives empty and single-element input', () => {
    expect(percentile([], 0.5)).toBe(0)
    expect(percentile([42], 0.99)).toBe(42)
  })

  it('clamps fractions outside [0, 1]', () => {
    expect(percentile([1, 2, 3], -1)).toBe(1)
    expect(percentile([1, 2, 3], 5)).toBe(3)
  })
})

describe('fractionAbove', () => {
  it('counts strictly greater, matching a linear scan', () => {
    const sorted = [1, 2, 2, 3, 5, 8, 8, 8, 13]
    ;[0, 1, 2, 4, 8, 13, 20].forEach((value) => {
      const scanned = sorted.filter((x) => x > value).length / sorted.length
      expect(fractionAbove(sorted, value)).toBeCloseTo(scanned, 12)
    })
  })

  it('is 0 above the maximum and 1 below the minimum', () => {
    expect(fractionAbove([1, 2, 3], 99)).toBe(0)
    expect(fractionAbove([1, 2, 3], 0)).toBe(1)
  })

  it('handles an empty sample', () => {
    expect(fractionAbove([], 5)).toBe(0)
  })
})

describe('amplification', () => {
  it('is the probability at least one of k independent calls is slow', () => {
    expect(amplification(0.01, 1)).toBeCloseTo(0.01, 12)
    expect(amplification(0.01, 100)).toBeCloseTo(1 - 0.99 ** 100, 12)
  })

  it('reproduces the number the whole figure exists for', () => {
    // One call in a hundred is slow; a hundred-call page is slow 63% of the
    // time. This is the DDIA Ch 2 claim, stated as a test.
    expect(amplification(0.01, 100)).toBeGreaterThan(0.63)
    expect(amplification(0.01, 100)).toBeLessThan(0.64)
  })

  it('rises with fan-out and never leaves [0, 1]', () => {
    let previous = -1
    for (let k = 0; k <= 500; k += 1) {
      const value = amplification(0.01, k)
      expect(value).toBeGreaterThanOrEqual(previous)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
      previous = value
    }
  })
})

describe('the latency distribution', () => {
  it('puts the median where it says it does', () => {
    // Median is held fixed so the tail control means "the tail moved", not
    // "everything moved". If this drifts, the figure's whole framing is wrong.
    const model = buildLatencyModel({ ...BASE, fanOut: 1, pageCount: 20000 })
    expect(model.callPercentiles.p50).toBeGreaterThan(MEDIAN_CALL_MS * 0.96)
    expect(model.callPercentiles.p50).toBeLessThan(MEDIAN_CALL_MS * 1.04)
  })

  it('puts p99 where the control asks', () => {
    ;[300, 1000, 2500].forEach((callP99) => {
      const model = buildLatencyModel({ ...BASE, callP99, fanOut: 1, pageCount: 40000 })
      expect(model.callPercentiles.p99 / callP99).toBeGreaterThan(0.9)
      expect(model.callPercentiles.p99 / callP99).toBeLessThan(1.1)
    })
  })

  it('is right-skewed, which is the property that makes a tail exist', () => {
    // Mean above median. A symmetric distribution would have no tail to
    // amplify and the visualization would be showing nothing.
    const model = buildLatencyModel({ ...BASE, fanOut: 1, pageCount: 20000 })
    const mean =
      model.callLatencies.reduce((total, x) => total + x, 0) / model.callLatencies.length
    expect(mean).toBeGreaterThan(model.callPercentiles.p50 * 1.1)
  })

  it('widens the tail without moving the middle as the control rises', () => {
    const tight = buildLatencyModel({ ...BASE, callP99: 200, fanOut: 1, pageCount: 20000 })
    const heavy = buildLatencyModel({ ...BASE, callP99: 3000, fanOut: 1, pageCount: 20000 })

    expect(heavy.callPercentiles.p99).toBeGreaterThan(tight.callPercentiles.p99 * 5)
    expect(Math.abs(heavy.callPercentiles.p50 - tight.callPercentiles.p50)).toBeLessThan(8)
  })
})

describe('fan-out amplification', () => {
  it('keeps exactly 1% of calls above the threshold, by construction', () => {
    const model = buildLatencyModel(BASE)
    expect(model.callExceedRate).toBeGreaterThan(0.005)
    expect(model.callExceedRate).toBeLessThan(0.015)
  })

  it('matches the theory it is drawn beside', () => {
    // The measured share of slow pages should track 1 - (1 - p)^k. This is
    // the check that the simulation and the formula are describing the same
    // thing; if they drift apart, one of them is wrong.
    ;[1, 5, 20, 100].forEach((fanOut) => {
      const model = buildLatencyModel({ ...BASE, fanOut, pageCount: 8000 })
      const theory = amplification(0.01, fanOut)
      expect(Math.abs(model.pageExceedRate - theory)).toBeLessThan(0.03)
    })
  })

  it('leaves pages alone when there is no fan-out', () => {
    const model = buildLatencyModel({ ...BASE, fanOut: 1, pageCount: 8000 })
    expect(model.pageExceedRate).toBeCloseTo(model.callExceedRate, 6)
    expect(model.pagePercentiles.p50).toBeCloseTo(model.callPercentiles.p50, 6)
  })

  it('makes the typical page slower than the typical call as fan-out rises', () => {
    // The mechanism, stated directly: a page waits for its slowest call, so
    // the median page is drawn from the max of k draws and shifts right.
    const model = buildLatencyModel({ ...BASE, fanOut: 50, pageCount: 4000 })
    expect(model.pagePercentiles.p50).toBeGreaterThan(model.callPercentiles.p90)
  })

  it('gives the inspector real pages from the same run', () => {
    // Each inspectable page's slowest call must actually appear in the page
    // distribution drawn beneath it. If the inspector showed a page generated
    // from its own stream it would be statistically fine and still a lie.
    const model = buildLatencyModel({ ...BASE, pageCount: 500 })
    const pages = new Set(model.pageLatencies)

    expect(model.inspectablePages.length).toBeGreaterThan(0)
    model.inspectablePages.forEach((calls) => {
      expect(calls).toHaveLength(BASE.fanOut)
      expect(pages.has(Math.max(...calls))).toBe(true)
    })
  })
})

describe('buildLatencyModel', () => {
  it('replays identically from the same seed', () => {
    const a = buildLatencyModel({ ...BASE, pageCount: 300 })
    const b = buildLatencyModel({ ...BASE, pageCount: 300 })
    expect(a.pageLatencies).toEqual(b.pageLatencies)
  })

  it('produces a different run for a different seed', () => {
    const a = buildLatencyModel({ ...BASE, pageCount: 300, seed: 1 })
    const b = buildLatencyModel({ ...BASE, pageCount: 300, seed: 2 })
    expect(a.pageLatencies).not.toEqual(b.pageLatencies)
  })

  it('generates distinct latencies rather than one value repeated', () => {
    // The assertion that caught a degenerate generator twice on this project:
    // "reproducible from a seed" is satisfied by any constant.
    const model = buildLatencyModel({ ...BASE, pageCount: 400 })
    expect(new Set(model.pageLatencies).size).toBeGreaterThan(model.pageLatencies.length * 0.9)
  })

  it('returns both samples sorted ascending', () => {
    const model = buildLatencyModel({ ...BASE, pageCount: 400 })
    ;[model.callLatencies, model.pageLatencies].forEach((series) => {
      for (let i = 1; i < series.length; i += 1) {
        expect(series[i]).toBeGreaterThanOrEqual(series[i - 1] ?? 0)
      }
    })
  })

  it('produces one page latency per page and fanOut calls each', () => {
    const model = buildLatencyModel({ ...BASE, fanOut: 7, pageCount: 250 })
    expect(model.pageLatencies).toHaveLength(250)
    expect(model.callLatencies).toHaveLength(250 * 7)
  })

  it('survives the smallest possible run', () => {
    const model = buildLatencyModel({ callP99: 1000, fanOut: 1, pageCount: 1, seed: 3 })
    expect(model.pageLatencies).toHaveLength(1)
    expect(Number.isFinite(model.threshold)).toBe(true)
    expect(model.inspectablePages).toHaveLength(1)
    expect(model.inspectablePages[0]).toHaveLength(1)
  })

  it('never emits a negative or non-finite latency', () => {
    const model = buildLatencyModel({ ...BASE, callP99: 3000, pageCount: 500 })
    model.callLatencies.forEach((latency) => {
      expect(Number.isFinite(latency)).toBe(true)
      expect(latency).toBeGreaterThan(0)
    })
  })
})

describe('createRng', () => {
  it('produces normals with about the right mean and spread', () => {
    const rng = createRng(11)
    const values = Array.from({ length: 50000 }, () => rng.normal())
    const mean = values.reduce((total, x) => total + x, 0) / values.length
    const variance =
      values.reduce((total, x) => total + (x - mean) ** 2, 0) / values.length

    expect(Math.abs(mean)).toBeLessThan(0.02)
    expect(Math.abs(Math.sqrt(variance) - 1)).toBeLessThan(0.02)
  })

  it('produces a symmetric distribution', () => {
    const rng = createRng(23)
    const values = Array.from({ length: 20000 }, () => rng.normal())
    const above = values.filter((x) => x > 0).length / values.length
    expect(Math.abs(above - 0.5)).toBeLessThan(0.02)
  })

  it('reaches the tails it needs to', () => {
    // A generator that never returns |z| > 2 would quietly flatten the tail,
    // which is the one feature this visualization depends on.
    const rng = createRng(5)
    const values = Array.from({ length: 20000 }, () => rng.normal())
    expect(values.some((x) => x > 3)).toBe(true)
    expect(values.some((x) => x < -3)).toBe(true)
  })
})

describe('formatLatency', () => {
  it('switches units where a reader would', () => {
    expect(formatLatency(94.4)).toBe('94ms')
    expect(formatLatency(999)).toBe('999ms')
    expect(formatLatency(1000)).toBe('1.00s')
    expect(formatLatency(2460)).toBe('2.46s')
    expect(formatLatency(42000)).toBe('42.0s')
  })
})
