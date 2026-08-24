/**
 * AGENT-OWNED — tests against the human's implementations.
 *
 * These are RED until hash.ts, rng.ts and ring.ts are filled in. Work down
 * the file: rng → hash → ring. Each block only depends on the ones above it.
 */

import { describe, expect, it } from 'vitest'
import { assignModN, hash } from './hash'
import { createRing } from './ring'
import { createRng, generateKeys } from './rng'
import { HASH_SPACE_SIZE } from './types'
import { diff, loadSkew } from './run'
import type { KeyId, NodeId } from './types'

const SEED = 42

function keysFrom(seed: number, count: number): KeyId[] {
  return generateKeys(createRng(seed), count)
}

function ringWith(nodeIds: readonly NodeId[], virtualNodes: number) {
  const ring = createRing()
  nodeIds.forEach((nodeId) => ring.addNode(nodeId, virtualNodes))
  return ring
}

function assignmentOf(ring: ReturnType<typeof createRing>, keys: readonly KeyId[]) {
  const assignment = new Map<KeyId, NodeId>()
  keys.forEach((key) => {
    const owner = ring.lookup(key)
    if (owner !== undefined) {
      assignment.set(key, owner)
    }
  })
  return assignment
}

describe('createRng', () => {
  it('replays identically for the same seed', () => {
    const first = Array.from({ length: 20 }, () => createRng(SEED).next())
    const rngA = createRng(SEED)
    const rngB = createRng(SEED)
    const sequenceA = Array.from({ length: 20 }, () => rngA.next())
    const sequenceB = Array.from({ length: 20 }, () => rngB.next())

    expect(sequenceA).toEqual(sequenceB)
    expect(first[0]).toBe(sequenceA[0])
  })

  it('diverges for different seeds', () => {
    const rngA = createRng(1)
    const rngB = createRng(2)
    const sequenceA = Array.from({ length: 20 }, () => rngA.next())
    const sequenceB = Array.from({ length: 20 }, () => rngB.next())

    expect(sequenceA).not.toEqual(sequenceB)
  })

  it('stays in [0, 1)', () => {
    const rng = createRng(SEED)
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('nextInt is inclusive at both ends and never escapes the range', () => {
    const rng = createRng(SEED)
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i += 1) {
      const value = rng.nextInt(1, 6)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(1)
      expect(value).toBeLessThanOrEqual(6)
      seen.add(value)
    }
    expect(seen.size).toBe(6)
  })
})

describe('generateKeys', () => {
  it('is reproducible from the same seed', () => {
    expect(keysFrom(SEED, 50)).toEqual(keysFrom(SEED, 50))
  })

  it('produces the requested number of distinct keys', () => {
    const keys = keysFrom(SEED, 500)
    expect(keys).toHaveLength(500)
    expect(new Set(keys).size).toBe(500)
  })
})

describe('hash', () => {
  it('is deterministic', () => {
    expect(hash('user:4821')).toBe(hash('user:4821'))
  })

  it('stays inside the hash space', () => {
    keysFrom(SEED, 500).forEach((key) => {
      const position = hash(key)
      expect(Number.isInteger(position)).toBe(true)
      expect(position).toBeGreaterThanOrEqual(0)
      expect(position).toBeLessThan(HASH_SPACE_SIZE)
    })
  })

  it('scatters a family of prefix-sharing ids across the whole space', () => {
    // This is the shape virtual node ids actually take: one shared prefix and
    // a trailing counter. It is the hardest case for a rolling hash, because
    // every id in the family shares an accumulator right up to the final
    // characters.
    //
    // The earlier version of this test compared five strings pairwise and
    // asked only that the MEDIAN gap exceed 1% of the ring. Plain FNV-1a
    // passes that while placing all 150 replicas of a node into a few tight
    // clumps: consecutive ids differ by small integer multiples of the FNV
    // prime (~0.39% of the space each), so they cluster instead of scattering.
    // Load skew then stops falling as virtual nodes rise, and the whole point
    // of the visualization disappears. Distribution is the real requirement,
    // so measure distribution.
    const BUCKETS = 16
    const REPLICAS = 2000
    const counts = new Array<number>(BUCKETS).fill(0)

    for (let replica = 0; replica < REPLICAS; replica += 1) {
      const bucket = Math.floor((hash(`n1#${replica}`) / HASH_SPACE_SIZE) * BUCKETS)
      counts[bucket] = (counts[bucket] ?? 0) + 1
    }

    // 125 expected per bucket, sigma about 10.8, so +/-40% is roughly 4.6
    // sigma: tight enough to catch clustering, loose enough never to flake.
    const expected = REPLICAS / BUCKETS
    counts.forEach((count) => {
      expect(count).toBeGreaterThan(expected * 0.6)
      expect(count).toBeLessThan(expected * 1.4)
    })
  })

  it('distributes roughly uniformly across the space', () => {
    const BUCKETS = 10
    const counts = new Array<number>(BUCKETS).fill(0)
    const keys = keysFrom(SEED, 10_000)

    keys.forEach((key) => {
      const bucket = Math.floor((hash(key) / HASH_SPACE_SIZE) * BUCKETS)
      counts[bucket] = (counts[bucket] ?? 0) + 1
    })

    const expected = keys.length / BUCKETS
    counts.forEach((count) => {
      expect(count).toBeGreaterThan(expected * 0.7)
      expect(count).toBeLessThan(expected * 1.3)
    })
  })
})

describe('Ring — structure', () => {
  it('is empty before any node is added', () => {
    expect(createRing().lookup('anything')).toBeUndefined()
  })

  it('creates one virtual node per replica', () => {
    const ring = ringWith(['n1', 'n2'], 16)
    expect(ring.positions()).toHaveLength(32)
    expect([...ring.nodeIds()].sort()).toEqual(['n1', 'n2'])
  })

  it('gives each replica a distinct position', () => {
    const positions = ringWith(['n1'], 64).positions()
    expect(new Set(positions.map((virtualNode) => virtualNode.position)).size).toBe(64)
  })

  it('keeps positions sorted', () => {
    const positions = ringWith(['n1', 'n2', 'n3'], 20).positions()
    const sorted = [...positions].sort((a, b) => a.position - b.position)
    expect(positions.map((v) => v.position)).toEqual(sorted.map((v) => v.position))
  })

  it('removes every virtual node belonging to a removed node', () => {
    const ring = ringWith(['n1', 'n2'], 16)
    ring.removeNode('n1')
    expect(ring.positions()).toHaveLength(16)
    expect(ring.nodeIds()).toEqual(['n2'])
    expect(ring.positions().every((virtualNode) => virtualNode.nodeId === 'n2')).toBe(true)
  })
})

describe('Ring — lookup', () => {
  it('is stable: same key, unchanged ring, same node', () => {
    const ring = ringWith(['n1', 'n2', 'n3'], 32)
    keysFrom(SEED, 200).forEach((key) => {
      expect(ring.lookup(key)).toBe(ring.lookup(key))
    })
  })

  it('always resolves to a node that is actually on the ring', () => {
    const ring = ringWith(['n1', 'n2', 'n3'], 8)
    const owners = new Set(ring.nodeIds())

    keysFrom(SEED, 2000).forEach((key) => {
      const owner = ring.lookup(key)
      expect(owner).toBeDefined()
      expect(owners.has(owner as NodeId)).toBe(true)
    })
  })

  it('WRAPS: a key hashing past the last virtual node maps to the first', () => {
    const ring = ringWith(['n1'], 4)
    const maxPosition = Math.max(...ring.positions().map((virtualNode) => virtualNode.position))

    let wrapKey: KeyId | undefined
    for (let i = 0; i < 100_000 && wrapKey === undefined; i += 1) {
      const candidate = `wrap-probe-${i}`
      if (hash(candidate) > maxPosition) {
        wrapKey = candidate
      }
    }

    expect(wrapKey).toBeDefined()
    expect(ring.lookup(wrapKey as KeyId)).toBe('n1')
  })
})

describe('Ring — the properties the page exists to show', () => {
  it('removing a node moves ONLY the keys that node owned', () => {
    const keys = keysFrom(SEED, 5000)
    const ring = ringWith(['n1', 'n2', 'n3', 'n4'], 64)
    const before = assignmentOf(ring, keys)

    ring.removeNode('n2')
    const after = assignmentOf(ring, keys)

    diff(before, after).forEach((move) => {
      expect(move.from).toBe('n2')
    })
  })

  it('adding a node to N relocates roughly K/(N+1) keys', () => {
    const keys = keysFrom(SEED, 10_000)
    const ring = ringWith(['n1', 'n2', 'n3', 'n4'], 128)
    const before = assignmentOf(ring, keys)

    ring.addNode('n5', 128)
    const after = assignmentOf(ring, keys)

    const movedFraction = diff(before, after).length / keys.length
    expect(movedFraction).toBeGreaterThan(0.1)
    expect(movedFraction).toBeLessThan(0.3)
  })

  it('load skew falls as virtual nodes increase', () => {
    const keys = keysFrom(SEED, 10_000)
    const nodeIds = ['n1', 'n2', 'n3', 'n4', 'n5']

    const skewAtOne = loadSkew(assignmentOf(ringWith(nodeIds, 1), keys), nodeIds)
    const skewAtMany = loadSkew(assignmentOf(ringWith(nodeIds, 200), keys), nodeIds)

    expect(skewAtMany).toBeLessThan(skewAtOne)

    // Theory says skew falls as 1/sqrt(V), so V=200 should land near 0.071.
    // The previous threshold here was 0.2, which a clustering hash cleared at
    // ~0.19 while showing no 1/sqrt(V) trend whatsoever. 0.12 is comfortably
    // above the theoretical value but well below what clustering produces.
    expect(skewAtMany).toBeLessThan(0.12)
  })

  it('load skew keeps falling between 50 and 500 virtual nodes', () => {
    // The single-point check above can be passed by luck. This one asserts the
    // TREND, which is the actual lesson of the page: more virtual nodes means
    // more even load. A hash that clumps prefix-sharing ids produces a flat or
    // noisy line here regardless of how high V goes.
    const keys = keysFrom(SEED, 10_000)
    const nodeIds = ['n1', 'n2', 'n3', 'n4', 'n5']

    const skewAtFifty = loadSkew(assignmentOf(ringWith(nodeIds, 50), keys), nodeIds)
    const skewAtFiveHundred = loadSkew(assignmentOf(ringWith(nodeIds, 500), keys), nodeIds)

    expect(skewAtFiveHundred).toBeLessThan(skewAtFifty)
    expect(skewAtFiveHundred).toBeLessThan(0.08)
  })
})

describe('assignModN — the baseline the ring is argued against', () => {
  it('distributes evenly for a fixed node count', () => {
    const keys = keysFrom(SEED, 10_000)
    const nodeIds = ['n1', 'n2', 'n3', 'n4']
    const counts = new Map<NodeId, number>()

    keys.forEach((key) => {
      const owner = assignModN(key, nodeIds)
      if (owner !== undefined) {
        counts.set(owner, (counts.get(owner) ?? 0) + 1)
      }
    })

    counts.forEach((count) => {
      expect(count).toBeGreaterThan((keys.length / nodeIds.length) * 0.9)
    })
  })

  it('relocates almost EVERY key when the node count changes', () => {
    const keys = keysFrom(SEED, 10_000)
    const before = new Map<KeyId, NodeId>()
    const after = new Map<KeyId, NodeId>()

    keys.forEach((key) => {
      const fourNodes = assignModN(key, ['n1', 'n2', 'n3', 'n4'])
      const fiveNodes = assignModN(key, ['n1', 'n2', 'n3', 'n4', 'n5'])
      if (fourNodes !== undefined) before.set(key, fourNodes)
      if (fiveNodes !== undefined) after.set(key, fiveNodes)
    })

    const movedFraction = diff(before, after).length / keys.length
    expect(movedFraction).toBeGreaterThan(0.7)
  })
})
