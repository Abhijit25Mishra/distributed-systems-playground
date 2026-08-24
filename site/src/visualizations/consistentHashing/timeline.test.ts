import { describe, expect, it } from 'vitest'
import { cursorState, requestLabel, sampleRequests } from './timeline'
import { createRng, generateKeys } from './rng'

const KEYS = generateKeys(createRng(444), 2000)

describe('sampleRequests', () => {
  it('only ever returns keys that are in the set', () => {
    // The point of the whole change: a request is one of the keys the figure
    // is already drawing. An earlier version invented its own keys alongside
    // the cloud, so the figure claimed two thousand keys and then animated
    // twelve things that were not among them.
    const present = new Set(KEYS)
    sampleRequests(KEYS, 12).forEach((request) => {
      expect(present.has(request.key)).toBe(true)
    })
  })

  it('reports the ordinal of the key it actually picked', () => {
    sampleRequests(KEYS, 12).forEach((request) => {
      expect(KEYS[request.ordinal - 1]).toBe(request.key)
      expect(request.outOf).toBe(KEYS.length)
    })
  })

  it('spreads the sample across the whole set rather than clustering', () => {
    const ordinals = sampleRequests(KEYS, 12).map((request) => request.ordinal)

    expect(Math.min(...ordinals)).toBeLessThan(KEYS.length * 0.1)
    expect(Math.max(...ordinals)).toBeGreaterThan(KEYS.length * 0.9)
  })

  it('returns distinct keys, not the same one repeated', () => {
    // Same assertion that caught a degenerate generator once before: any
    // constant satisfies "reproducible", so distinctness has to be checked
    // separately or it proves nothing.
    const requests = sampleRequests(KEYS, 40)
    expect(new Set(requests.map((request) => request.key)).size).toBe(requests.length)
  })

  it('is reproducible for the same key set', () => {
    expect(sampleRequests(KEYS, 12)).toEqual(sampleRequests(KEYS, 12))
  })

  it('never asks for more requests than there are keys', () => {
    expect(sampleRequests(KEYS.slice(0, 5), 12)).toHaveLength(5)
  })

  it('survives an empty key set and a zero count', () => {
    expect(sampleRequests([], 12)).toEqual([])
    expect(sampleRequests(KEYS, 0)).toEqual([])
  })

  it('never indexes past the end of the set', () => {
    for (let count = 1; count <= 60; count += 1) {
      sampleRequests(KEYS, count).forEach((request) => {
        expect(request.ordinal).toBeGreaterThanOrEqual(1)
        expect(request.ordinal).toBeLessThanOrEqual(KEYS.length)
      })
    }
  })
})

describe('requestLabel', () => {
  it('names the key by its place in the set', () => {
    const first = sampleRequests(KEYS, 12)[0]
    expect(first).toBeDefined()
    expect(requestLabel(first!)).toBe(`key ${first!.ordinal}`)
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
