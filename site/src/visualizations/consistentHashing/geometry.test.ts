import { describe, expect, it } from 'vitest'
import { midAngle, ownedArcs, spreadAngles, widestArcPerNode } from './geometry'
import { createRing } from './ring'
import { createRng, generateKeys } from './rng'
import { hash } from './hash'
import { HASH_SPACE_SIZE } from './types'
import type { VirtualNode } from './types'

const TAU = Math.PI * 2

function vnode(position: number, nodeId: string, replica = 0): VirtualNode {
  return { position, nodeId, replica }
}

describe('ownedArcs', () => {
  it('covers the whole ring exactly once', () => {
    const arcs = ownedArcs([
      vnode(0, 'n1'),
      vnode(HASH_SPACE_SIZE * 0.25, 'n2'),
      vnode(HASH_SPACE_SIZE * 0.6, 'n3'),
    ])

    const total = arcs.reduce((sum, arc) => sum + arc.share, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it('gives the arc BEFORE a virtual node to that node, matching lookup', () => {
    // The direction is the one thing here that encodes an algorithmic fact
    // rather than a drawing preference. `lookup` returns the first virtual
    // node at a position >= the key's, so the span leading up to a virtual
    // node is the span it owns. Drawn the other way, every key would appear
    // to sit in a neighbour's colour.
    const arcs = ownedArcs([vnode(100, 'n1'), vnode(500, 'n2')])
    const second = arcs.find((arc) => arc.nodeId === 'n2')

    expect(second?.startAngle).toBeCloseTo((100 / HASH_SPACE_SIZE) * TAU - Math.PI / 2, 10)
    expect(second?.endAngle).toBeCloseTo((500 / HASH_SPACE_SIZE) * TAU - Math.PI / 2, 10)
  })

  it('agrees with the real ring for every key', () => {
    // The strongest form of the check above: build a real ring, ask it who
    // owns each key, and confirm the key's angle falls inside an arc drawn for
    // that same node. If the renderer and the algorithm ever disagree, the
    // picture is lying and this fails.
    const ring = createRing()
    ring.addNode('n1', 4)
    ring.addNode('n2', 4)
    ring.addNode('n3', 4)

    const arcs = ownedArcs(ring.positions())
    const keys = generateKeys(createRng(7), 400)

    keys.forEach((key) => {
      const owner = ring.lookup(key)
      const angle = (hash(key) / HASH_SPACE_SIZE) * TAU - Math.PI / 2

      const containing = arcs.find((arc) => {
        const sweep = (arc.endAngle - arc.startAngle + TAU) % TAU
        const offset = (angle - arc.startAngle + TAU) % TAU
        return offset <= sweep
      })

      expect(containing?.nodeId).toBe(owner)
    })
  })

  it('returns nothing for an empty ring', () => {
    expect(ownedArcs([])).toEqual([])
  })
})

describe('widestArcPerNode', () => {
  it('keeps the largest arc for each node', () => {
    const arcs = ownedArcs([
      vnode(0, 'n1'),
      vnode(HASH_SPACE_SIZE * 0.1, 'n2'),
      vnode(HASH_SPACE_SIZE * 0.9, 'n1'),
    ])

    const widest = widestArcPerNode(arcs)
    expect(widest.size).toBe(2)
    expect(widest.get('n1')?.share).toBeGreaterThan(widest.get('n2')?.share ?? 1)
  })
})

describe('spreadAngles', () => {
  it('leaves angles alone when nothing collides', () => {
    const preferred = [0, TAU / 4, TAU / 2]
    expect(spreadAngles(preferred, 0.2)).toEqual(preferred)
  })

  it('separates labels that would overlap', () => {
    // The observed defect: at 150 virtual nodes two labels landed within a
    // hair of each other at 12 o'clock and neither was readable.
    const spread = spreadAngles([1.0, 1.02, 3.0], 0.3)

    const gap = Math.abs(((spread[1] ?? 0) - (spread[0] ?? 0) + TAU) % TAU)
    expect(Math.min(gap, TAU - gap)).toBeGreaterThanOrEqual(0.3 - 1e-6)
  })

  it('keeps every pair apart, including across the wrap', () => {
    const spread = spreadAngles([0.05, 0.1, 0.15, 6.25, 3.0], 0.35)

    for (let i = 0; i < spread.length; i += 1) {
      for (let j = i + 1; j < spread.length; j += 1) {
        const raw = Math.abs((spread[i] ?? 0) - (spread[j] ?? 0))
        const separation = Math.min(raw, TAU - raw)
        expect(separation).toBeGreaterThanOrEqual(0.35 - 1e-6)
      }
    }
  })

  it('falls back to even spacing when the circle cannot seat them all', () => {
    const spread = spreadAngles([0, 0, 0, 0], TAU / 3)
    expect(spread).toEqual([0, TAU / 4, TAU / 2, (TAU * 3) / 4])
  })

  it('preserves input order', () => {
    const spread = spreadAngles([3.0, 0.1], 0.5)
    expect(spread[0]).toBeGreaterThan(spread[1] ?? 0)
  })
})

describe('midAngle', () => {
  it('handles an arc that crosses the wrap point', () => {
    const arcs = ownedArcs([vnode(HASH_SPACE_SIZE * 0.9, 'n1'), vnode(HASH_SPACE_SIZE * 0.1, 'n2')])
    const wrapping = arcs.find((arc) => arc.nodeId === 'n2')

    expect(wrapping).toBeDefined()
    expect(Number.isFinite(midAngle(wrapping!))).toBe(true)
  })
})
