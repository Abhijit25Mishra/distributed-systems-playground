import { describe, expect, it } from 'vitest'
import { buildRequests, cursorState, DEFAULT_REQUEST_COUNT } from './timeline'

describe('buildRequests', () => {
  it('replays identically from the same seed', () => {
    expect(buildRequests(42, 12)).toEqual(buildRequests(42, 12))
  })

  it('produces different requests for different seeds', () => {
    expect(buildRequests(42, 12)).not.toEqual(buildRequests(43, 12))
  })

  it('produces distinct keys, not the same key repeated', () => {
    // This assertion exists because its absence hid a real bug once: an
    // earlier generator passed "replays identically from the same seed" while
    // returning 500 copies of one string. Reproducibility is satisfied by any
    // constant, so it proves nothing on its own.
    const requests = buildRequests(42, 40)
    expect(new Set(requests).size).toBeGreaterThan(requests.length * 0.8)
  })

  it('names keys in a readable form', () => {
    buildRequests(42, DEFAULT_REQUEST_COUNT).forEach((key) => {
      expect(key).toMatch(/^[a-z]+:\d{4}$/)
    })
  })

  it('returns exactly the count asked for', () => {
    expect(buildRequests(1, 0)).toHaveLength(0)
    expect(buildRequests(1, 7)).toHaveLength(7)
  })
})

describe('cursorState', () => {
  it('splits the cursor into a request index and its progress', () => {
    const state = cursorState(3.25, 12)
    expect(state.index).toBe(3)
    expect(state.progress).toBeCloseTo(0.25, 10)
    expect(state.finished).toBe(false)
  })

  it('counts only fully routed requests as completed', () => {
    // Request 3 is in flight at cursor 3.9, so three are done, not four.
    expect(cursorState(3.9, 12).completed).toBe(3)
    expect(cursorState(0.0, 12).completed).toBe(0)
  })

  it('holds the last request fully resolved once the run ends', () => {
    const state = cursorState(12, 12)
    expect(state.index).toBe(11)
    expect(state.progress).toBe(1)
    expect(state.completed).toBe(12)
    expect(state.finished).toBe(true)
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

  it('never reports an index outside the request list', () => {
    for (let step = 0; step <= 200; step += 1) {
      const state = cursorState((step / 200) * 12, 12)
      expect(state.index).toBeGreaterThanOrEqual(0)
      expect(state.index).toBeLessThan(12)
      expect(state.completed).toBeLessThanOrEqual(12)
    }
  })
})
