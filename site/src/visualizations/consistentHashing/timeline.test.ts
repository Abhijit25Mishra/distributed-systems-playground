import { describe, expect, it } from 'vitest'
import {
  buildRequests,
  cursorState,
  flightSeconds,
  FULL_FLIGHT_SECONDS,
  keysFromSlider,
  KEY_SLIDER_STEPS,
  MAX_KEYS,
  MIN_KEYS,
  requestLabel,
  sliderFromKeys,
} from './timeline'
import { createRng, generateKeys } from './rng'

const KEYS = generateKeys(createRng(54), 2000)

describe('buildRequests', () => {
  it('routes every key, not a sample of them', () => {
    // The defect this replaced: the figure said "2000 keys" and animated
    // twelve. If it claims N keys it routes N keys, so the question cannot
    // arise.
    expect(buildRequests(KEYS)).toHaveLength(KEYS.length)
    expect(buildRequests(KEYS.slice(0, 7))).toHaveLength(7)
  })

  it('keeps every key, in order, exactly once', () => {
    const requests = buildRequests(KEYS)
    expect(requests.map((request) => request.key)).toEqual([...KEYS])
  })

  it('numbers keys from one and reports the set size', () => {
    const requests = buildRequests(KEYS)
    expect(requests[0]?.ordinal).toBe(1)
    expect(requests[requests.length - 1]?.ordinal).toBe(KEYS.length)
    requests.forEach((request) => expect(request.outOf).toBe(KEYS.length))
  })

  it('handles a single key and an empty set', () => {
    expect(buildRequests([])).toEqual([])
    expect(buildRequests(['only'])).toEqual([{ key: 'only', ordinal: 1, outOf: 1 }])
  })
})

describe('requestLabel', () => {
  it('names the key by its place in the set', () => {
    expect(requestLabel({ key: 'k', ordinal: 42, outOf: 2000 })).toBe('key 42')
  })
})

describe('flightSeconds', () => {
  it('gives a small run the full readable pace', () => {
    expect(flightSeconds(1)).toBe(FULL_FLIGHT_SECONDS)
    expect(flightSeconds(10)).toBe(FULL_FLIGHT_SECONDS)
  })

  it('compresses as the key count grows', () => {
    expect(flightSeconds(100)).toBeLessThan(flightSeconds(20))
    expect(flightSeconds(2000)).toBeLessThan(flightSeconds(100))
  })

  it('never speeds up as keys are added', () => {
    for (let count = 1; count < MAX_KEYS; count += 7) {
      expect(flightSeconds(count + 1)).toBeLessThanOrEqual(flightSeconds(count))
    }
  })

  it('keeps the longest run under a minute at 1x', () => {
    // The reason the floor exists: at the full pace, 2000 keys would take 80
    // minutes.
    expect(flightSeconds(MAX_KEYS) * MAX_KEYS).toBeLessThan(60)
  })

  it('is always positive, so the cursor can never divide by zero', () => {
    ;[0, -5, 1, MAX_KEYS].forEach((count) => {
      expect(flightSeconds(count)).toBeGreaterThan(0)
    })
  })
})

describe('key slider scale', () => {
  it('spans exactly the intended range', () => {
    expect(keysFromSlider(0)).toBe(MIN_KEYS)
    expect(keysFromSlider(KEY_SLIDER_STEPS)).toBe(MAX_KEYS)
  })

  it('spends most of the track on small key counts', () => {
    // The point of making it logarithmic. A linear track would put 0.5% of its
    // length on the first ten keys, which is unhittable.
    const positions = Array.from({ length: 101 }, (_, percent) =>
      keysFromSlider((percent / 100) * KEY_SLIDER_STEPS),
    )

    expect(positions.filter((keys) => keys <= 10).length).toBeGreaterThanOrEqual(28)
    expect(positions.filter((keys) => keys <= 20).length).toBeGreaterThanOrEqual(38)
  })

  it('never skips a reachable count in the range a visitor reads one by one', () => {
    const reachable = new Set(
      Array.from({ length: KEY_SLIDER_STEPS + 1 }, (_, position) => keysFromSlider(position)),
    )

    for (let keys = 1; keys <= 20; keys += 1) {
      expect(reachable.has(keys)).toBe(true)
    }
  })

  it('rises monotonically across the track', () => {
    let previous = 0
    for (let position = 0; position <= KEY_SLIDER_STEPS; position += 1) {
      const keys = keysFromSlider(position)
      expect(keys).toBeGreaterThanOrEqual(previous)
      previous = keys
    }
  })

  it('round-trips exactly wherever every count is reachable', () => {
    // Exact below 20 because that is the range the scale exists to serve.
    for (let keys = MIN_KEYS; keys <= 20; keys += 1) {
      expect(keysFromSlider(sliderFromKeys(keys))).toBe(keys)
    }
  })

  it('round-trips to within a percent at the dense end', () => {
    // A thousand slider positions cannot address two thousand distinct counts,
    // so past a few hundred keys consecutive positions step by more than one
    // and a round trip lands on the nearest reachable count instead of the
    // exact one. That is the scale working, not failing: nobody distinguishes
    // 937 keys from 935 on a ring, whereas 3 from 4 is the whole lesson.
    ;[50, 200, 937, 1500, 2000].forEach((keys) => {
      const returned = keysFromSlider(sliderFromKeys(keys))
      expect(Math.abs(returned - keys) / keys).toBeLessThan(0.01)
    })
  })

  it('clamps out-of-range input rather than extrapolating', () => {
    expect(keysFromSlider(-50)).toBe(MIN_KEYS)
    expect(keysFromSlider(KEY_SLIDER_STEPS * 2)).toBe(MAX_KEYS)
    expect(sliderFromKeys(0)).toBe(0)
    expect(sliderFromKeys(99999)).toBe(KEY_SLIDER_STEPS)
  })
})

describe('cursorState', () => {
  it('splits the cursor into a key index and its progress', () => {
    const state = cursorState(3.25, 12)
    expect(state.index).toBe(3)
    expect(state.progress).toBeCloseTo(0.25, 10)
    expect(state.finished).toBe(false)
  })

  it('counts only fully routed keys as completed', () => {
    expect(cursorState(3.9, 12).completed).toBe(3)
    expect(cursorState(0.0, 12).completed).toBe(0)
  })

  it('holds the last key fully resolved once the run ends', () => {
    const state = cursorState(12, 12)
    expect(state.index).toBe(11)
    expect(state.progress).toBe(1)
    expect(state.completed).toBe(12)
    expect(state.finished).toBe(true)
  })

  it('works for a run of exactly one key', () => {
    expect(cursorState(0, 1).index).toBe(0)
    expect(cursorState(0, 1).finished).toBe(false)
    expect(cursorState(1, 1).finished).toBe(true)
    expect(cursorState(1, 1).completed).toBe(1)
  })

  it('clamps rather than running off either end', () => {
    expect(cursorState(-5, 12).index).toBe(0)
    expect(cursorState(-5, 12).progress).toBe(0)
    expect(cursorState(99, 12).index).toBe(11)
    expect(cursorState(99, 12).finished).toBe(true)
  })

  it('survives an empty run', () => {
    const state = cursorState(0, 0)
    expect(state.completed).toBe(0)
    expect(state.finished).toBe(true)
  })

  it('never reports an index outside the key list', () => {
    for (let step = 0; step <= 200; step += 1) {
      const state = cursorState((step / 200) * 2000, 2000)
      expect(state.index).toBeGreaterThanOrEqual(0)
      expect(state.index).toBeLessThan(2000)
      expect(state.completed).toBeLessThanOrEqual(2000)
    }
  })
})
