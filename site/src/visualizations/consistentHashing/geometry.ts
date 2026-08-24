/**
 * AGENT-OWNED — mapping ring positions to screen coordinates.
 *
 * Kept separate from the renderer so the arc-ownership rule can be tested
 * without a canvas. That rule is the one piece of geometry here that encodes
 * an algorithmic fact rather than a drawing convention, and getting it
 * backwards would draw a picture that contradicts what `lookup` actually does.
 */

import { HASH_SPACE_SIZE } from './types'
import type { NodeId, Position, VirtualNode } from './types'

const TAU = Math.PI * 2

/** Quarter turn, so position 0 sits at 12 o'clock and values run clockwise. */
const TOP_OFFSET = Math.PI / 2

export interface Point {
  readonly x: number
  readonly y: number
}

/** An arc of the ring owned by one virtual node, in radians. */
export interface OwnedArc {
  readonly nodeId: NodeId
  readonly startAngle: number
  readonly endAngle: number
  /** Share of the whole ring, in [0, 1]. */
  readonly share: number
}

export function angleOf(position: Position): number {
  return (position / HASH_SPACE_SIZE) * TAU - TOP_OFFSET
}

export function pointOn(center: Point, radius: number, angle: number): Point {
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  }
}

/**
 * Split the ring into the arcs each virtual node owns.
 *
 * The direction matters and is not arbitrary. `Ring.lookup` returns the first
 * virtual node at a position **>= the key's**, so a key falling between two
 * virtual nodes belongs to the one *after* it. The arc a virtual node owns
 * therefore runs from its predecessor up to itself, not from itself forward.
 *
 * Drawing it the other way round produces a picture where keys visibly sit in
 * one node's arc while the assignment says they belong to another, which is
 * the kind of contradiction that makes a visualization worse than no
 * visualization.
 */
export function ownedArcs(sorted: readonly VirtualNode[]): OwnedArc[] {
  if (sorted.length === 0) {
    return []
  }

  const arcs: OwnedArc[] = []

  for (let i = 0; i < sorted.length; i += 1) {
    const owner = sorted[i]
    const previous = sorted[(i - 1 + sorted.length) % sorted.length]

    if (!owner || !previous) {
      continue
    }

    const span =
      i === 0
        ? HASH_SPACE_SIZE - previous.position + owner.position
        : owner.position - previous.position

    arcs.push({
      nodeId: owner.nodeId,
      startAngle: angleOf(previous.position),
      endAngle: angleOf(owner.position),
      share: span / HASH_SPACE_SIZE,
    })
  }

  return arcs
}

/**
 * The single widest arc each node owns, keyed by node id.
 *
 * Used to place a direct label somewhere the node visibly occupies. A label at
 * the centroid of all a node's arcs would drift into a neighbour's territory,
 * since those arcs are scattered around the ring by design.
 */
export function widestArcPerNode(arcs: readonly OwnedArc[]): Map<NodeId, OwnedArc> {
  const widest = new Map<NodeId, OwnedArc>()

  arcs.forEach((arc) => {
    const current = widest.get(arc.nodeId)
    if (!current || arc.share > current.share) {
      widest.set(arc.nodeId, arc)
    }
  })

  return widest
}

/** Midpoint angle of an arc, accounting for the wrap at 12 o'clock. */
export function midAngle(arc: OwnedArc): number {
  const sweep = (arc.endAngle - arc.startAngle + TAU) % TAU
  return arc.startAngle + sweep / 2
}

const RELAXATION_PASSES = 60

/**
 * Push angles apart until no two are closer than `minGap`, keeping each as
 * near its preferred angle as possible.
 *
 * Labels are placed on the widest arc each node owns. That works while nodes
 * hold a few big arcs, but as virtual nodes rise every arc becomes a sliver
 * and the widest one is essentially arbitrary, so two labels can land on top
 * of each other. Observed at 150 virtual nodes: n1 and n2 overlapped at 12
 * o'clock and neither was readable.
 *
 * Relaxation rather than even distribution, because even distribution would
 * throw away the position information in the low-virtual-node case, where the
 * label genuinely does sit on the wedge it names.
 *
 * Returns angles in the same order as the input.
 */
export function spreadAngles(preferred: readonly number[], minGap: number): number[] {
  const count = preferred.length

  if (count < 2) {
    return [...preferred]
  }

  // More labels than the circle can seat: nothing to preserve, space evenly.
  if (count * minGap >= TAU) {
    return preferred.map((_, index) => (index / count) * TAU)
  }

  const order = preferred
    .map((angle, index) => ({ index, angle: ((angle % TAU) + TAU) % TAU }))
    .sort((a, b) => a.angle - b.angle)

  // Relax on a line, not on the circle. Taking the modulo inside the loop lets
  // a pushed label cross its neighbour, which silently invalidates the sorted
  // order the pass depends on: "adjacent in the array" stops meaning "adjacent
  // on the ring" and the fix-ups start working on the wrong pairs. Keeping
  // angles unwrapped preserves the cyclic order, so the sweep stays valid and
  // the whole thing converges. The wrap is handled once, as its own pair.
  for (let pass = 0; pass < RELAXATION_PASSES; pass += 1) {
    let moved = false

    for (let i = 0; i < count - 1; i += 1) {
      const current = order[i]
      const next = order[i + 1]

      if (!current || !next) {
        continue
      }

      const gap = next.angle - current.angle

      if (gap < minGap) {
        // Split the shortfall, so neither label is dragged the whole way and
        // both stay near the arc they name.
        const push = (minGap - gap) / 2
        current.angle -= push
        next.angle += push
        moved = true
      }
    }

    const first = order[0]
    const last = order[count - 1]

    if (first && last) {
      const wrapGap = first.angle + TAU - last.angle

      if (wrapGap < minGap) {
        const push = (minGap - wrapGap) / 2
        last.angle -= push
        first.angle += push
        moved = true
      }
    }

    if (!moved) {
      break
    }
  }

  const result = new Array<number>(count).fill(0)
  order.forEach((entry) => {
    result[entry.index] = ((entry.angle % TAU) + TAU) % TAU
  })

  return result
}
