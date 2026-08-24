/**
 * AGENT-OWNED — replay machinery and measurement.
 *
 * A Run is a seed plus an ordered list of operations. State at any index is
 * recomputed by replaying operations [0..index] into a fresh ring — nothing
 * is recorded, so seeking is cheap and memory stays flat. This is what NFRs
 * N1, N2, N5 and N6 in the design doc depend on.
 */

import { assignModN } from './hash'
import { createRing } from './ring'
import { createRng, generateKeys } from './rng'
import type { Assignment, KeyId, KeyMove, NodeId } from './types'

export type Operation =
  | { readonly kind: 'addNode'; readonly nodeId: NodeId; readonly virtualNodes: number }
  | { readonly kind: 'removeNode'; readonly nodeId: NodeId }
  | { readonly kind: 'addKeys'; readonly count: number }

export interface Run {
  readonly seed: number
  readonly operations: readonly Operation[]
}

export interface RunState {
  readonly assignment: Assignment
  readonly modNAssignment: Assignment
  readonly nodeIds: readonly NodeId[]
  readonly keys: readonly KeyId[]
}

export function createRun(seed: number, operations: readonly Operation[]): Run {
  return { seed, operations }
}

/**
 * Replay `operations[0..index]` into a fresh ring and return the resulting
 * assignment, alongside the naive `hash % N` assignment over the same keys.
 */
export function stateAt(run: Run, index: number): RunState {
  const ring = createRing()
  const rng = createRng(run.seed)
  const keys: KeyId[] = []

  for (let i = 0; i <= index && i < run.operations.length; i += 1) {
    const operation = run.operations[i]
    if (!operation) {
      continue
    }

    switch (operation.kind) {
      case 'addNode':
        ring.addNode(operation.nodeId, operation.virtualNodes)
        break
      case 'removeNode':
        ring.removeNode(operation.nodeId)
        break
      case 'addKeys':
        keys.push(...generateKeys(rng, operation.count))
        break
    }
  }

  const nodeIds = ring.nodeIds()
  const assignment = new Map<KeyId, NodeId>()
  const modNAssignment = new Map<KeyId, NodeId>()

  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i]
    if (!key) {
      continue
    }

    const owner = ring.lookup(key)
    if (owner !== undefined) {
      assignment.set(key, owner)
    }

    const modNOwner = assignModN(key, nodeIds)
    if (modNOwner !== undefined) {
      modNAssignment.set(key, modNOwner)
    }
  }

  return { assignment, modNAssignment, nodeIds, keys }
}

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
