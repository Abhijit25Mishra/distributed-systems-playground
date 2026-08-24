import { describe, expect, it } from 'vitest'
import { hasReached, phaseAt, replicaName, traceRequest } from './trace'
import type { FlightPhase } from './trace'
import { createRing } from './ring'
import { createRng, generateKeys } from './rng'
import { hash } from './hash'
import { HASH_SPACE_SIZE } from './types'

const TAU = Math.PI * 2

function ringOf(nodes: number, virtualNodes: number) {
  const ring = createRing()
  for (let i = 1; i <= nodes; i += 1) {
    ring.addNode(`n${i}`, virtualNodes)
  }
  return ring
}

describe('traceRequest', () => {
  it('names the same owner as lookup, for every key', () => {
    // The load-bearing test in this file. The animation is only worth having
    // if it shows what the algorithm actually does, so the trace is checked
    // against the hand-written lookup rather than against its own reasoning.
    const ring = ringOf(4, 16)
    const keys = generateKeys(createRng(42), 500)

    keys.forEach((key) => {
      const trace = traceRequest(ring.positions(), key)
      expect(trace?.owner).toBe(ring.lookup(key))
    })
  })

  it('lands on a replica belonging to the owner it reports', () => {
    const ring = ringOf(4, 16)

    generateKeys(createRng(7), 200).forEach((key) => {
      const trace = traceRequest(ring.positions(), key)
      expect(trace?.landing.nodeId).toBe(trace?.owner)
    })
  })

  it('walks clockwise only, never further than one full turn', () => {
    const ring = ringOf(3, 8)

    generateKeys(createRng(11), 300).forEach((key) => {
      const trace = traceRequest(ring.positions(), key)
      expect(trace).toBeDefined()
      expect(trace!.sweep).toBeGreaterThanOrEqual(0)
      expect(trace!.sweep).toBeLessThanOrEqual(TAU + 1e-9)
    })
  })

  it('flags the wrap exactly when the key hashed past the last replica', () => {
    // The wrap is the single most common bug in a consistent hashing
    // implementation and the one case where the drawn walk crosses 12
    // o'clock, so the flag is checked against the positions directly rather
    // than trusted.
    const ring = ringOf(4, 16)
    const sorted = ring.positions()
    const last = sorted[sorted.length - 1]
    expect(last).toBeDefined()

    let sawWrap = false
    let sawNormal = false

    generateKeys(createRng(3), 800).forEach((key) => {
      const trace = traceRequest(sorted, key)
      const position = hash(key) % HASH_SPACE_SIZE
      const shouldWrap = position > last!.position

      expect(trace?.wrapped).toBe(shouldWrap)
      sawWrap ||= shouldWrap
      sawNormal ||= !shouldWrap
    })

    // A test that never exercises the branch it is aimed at is not a test.
    expect(sawWrap).toBe(true)
    expect(sawNormal).toBe(true)
  })

  it('sends a wrapped key to the very first replica on the ring', () => {
    const ring = ringOf(4, 16)
    const sorted = ring.positions()
    const first = sorted[0]

    const wrapped = generateKeys(createRng(3), 800)
      .map((key) => traceRequest(sorted, key))
      .filter((trace) => trace?.wrapped)

    expect(wrapped.length).toBeGreaterThan(0)
    wrapped.forEach((trace) => {
      expect(trace?.landing.position).toBe(first?.position)
    })
  })

  it('returns nothing when the ring is empty', () => {
    expect(traceRequest([], 'user:1')).toBeUndefined()
  })

  it('names a replica the way the ring built it', () => {
    // addNode hashes `${nodeId}#${replica}`, so the label has to match that
    // string or it would be pointing at a position nothing was hashed to.
    const ring = ringOf(2, 4)
    const virtualNode = ring.positions()[0]

    expect(virtualNode).toBeDefined()
    expect(hash(replicaName(virtualNode!)) % HASH_SPACE_SIZE).toBe(virtualNode!.position)
  })
})

describe('phaseAt', () => {
  const ORDER: readonly FlightPhase[] = ['arrive', 'hash', 'drop', 'walk', 'resolve']

  it('starts at the first phase and ends at the last', () => {
    expect(phaseAt(0).phase).toBe('arrive')
    expect(phaseAt(1).phase).toBe('resolve')
    expect(phaseAt(1).local).toBe(1)
  })

  it('never skips a phase as progress advances', () => {
    let previous = -1

    for (let step = 0; step <= 1000; step += 1) {
      const state = phaseAt(step / 1000)
      const index = ORDER.indexOf(state.phase)

      expect(index).toBeGreaterThanOrEqual(previous)
      expect(index - previous).toBeLessThanOrEqual(1)
      previous = index
    }

    expect(previous).toBe(ORDER.length - 1)
  })

  it('keeps local progress inside [0, 1] everywhere', () => {
    for (let step = 0; step <= 500; step += 1) {
      const state = phaseAt(step / 500)
      expect(state.local).toBeGreaterThanOrEqual(0)
      expect(state.local).toBeLessThanOrEqual(1)
    }
  })

  it('clamps out-of-range progress rather than extrapolating', () => {
    expect(phaseAt(-4).phase).toBe('arrive')
    expect(phaseAt(-4).overall).toBe(0)
    expect(phaseAt(9).phase).toBe('resolve')
    expect(phaseAt(9).overall).toBe(1)
  })

  it('reaches every phase for some progress value', () => {
    const seen = new Set<FlightPhase>()
    for (let step = 0; step <= 1000; step += 1) {
      seen.add(phaseAt(step / 1000).phase)
    }
    expect([...seen].sort()).toEqual([...ORDER].sort())
  })
})

describe('hasReached', () => {
  it('is true for the current phase and every earlier one', () => {
    const state = phaseAt(0.6)
    expect(state.phase).toBe('walk')

    expect(hasReached(state, 'arrive')).toBe(true)
    expect(hasReached(state, 'drop')).toBe(true)
    expect(hasReached(state, 'walk')).toBe(true)
    expect(hasReached(state, 'resolve')).toBe(false)
  })
})
