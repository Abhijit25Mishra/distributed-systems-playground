/**
 * AGENT-OWNED — measurement over an assignment.
 *
 * Three pure functions, each answering one question about a key-to-node map:
 * what moved, who holds how much, and how uneven that is.
 *
 * This file used to also hold replay machinery -- a Run of operations and a
 * `stateAt(index)` that rebuilt a ring by replaying them. It was written before
 * the timeline existed and the timeline did not need it: the ring is fixed by
 * the control values and the cursor only selects which request is in flight,
 * so there was nothing to replay. It was deleted rather than left in place;
 * see timeline.ts for the model that replaced it.
 */

import type { Assignment, KeyId, KeyMove, NodeId } from './types'

/** Keys whose owner differs between two assignments. */
export function diff(before: Assignment, after: Assignment): KeyMove[] {
  const moves: KeyMove[] = []
  const allKeys = new Set<KeyId>([...before.keys(), ...after.keys()])

  allKeys.forEach((key) => {
    const from = before.get(key)
    const to = after.get(key)
    if (from !== to) {
      moves.push({ key, from, to })
    }
  })

  return moves
}

/** Keys per node — the load distribution shown in the chart. */
export function loadDistribution(assignment: Assignment): ReadonlyMap<NodeId, number> {
  const counts = new Map<NodeId, number>()
  assignment.forEach((nodeId) => {
    counts.set(nodeId, (counts.get(nodeId) ?? 0) + 1)
  })
  return counts
}

/**
 * Coefficient of variation of the load — stddev / mean. Scale-free, so it
 * stays comparable as key count changes. This is the number that should fall
 * as virtual nodes increase.
 *
 * Read it with the sample size in mind. Over 2000 keys across four nodes it is
 * within about 17% of the converged value; over 600 it was out by as much as
 * 63%, which is why the figure no longer defaults that low.
 */
export function loadSkew(assignment: Assignment, nodeIds: readonly NodeId[]): number {
  if (nodeIds.length === 0) {
    return 0
  }

  const counts = loadDistribution(assignment)
  const loads = nodeIds.map((nodeId) => counts.get(nodeId) ?? 0)
  const mean = loads.reduce((total, load) => total + load, 0) / loads.length

  if (mean === 0) {
    return 0
  }

  const variance = loads.reduce((total, load) => total + (load - mean) ** 2, 0) / loads.length
  return Math.sqrt(variance) / mean
}
