/**
 * AGENT-OWNED — turns the control values into everything the page displays.
 *
 * Pure and synchronous. The design doc settled this: a run is generated in
 * full, instantly, and playback speed is a separate display concern. Nothing
 * here is memoised across calls because nothing needs to be; the whole
 * computation is a few milliseconds at the sizes the page uses.
 */

import { assignModN } from './hash'
import { createRing } from './ring'
import { createRng, generateKeys } from './rng'
import { diff, loadDistribution, loadSkew } from './run'
import type { Assignment, KeyId, NodeId, VirtualNode } from './types'

export interface RingParams {
  readonly nodeCount: number
  readonly virtualNodes: number
  readonly keyCount: number
  readonly seed: number
}

export interface NodeLoad {
  readonly nodeId: NodeId
  readonly keys: number
  /** Share of all assigned keys, in [0, 1]. */
  readonly share: number
}

export interface RingModel {
  readonly virtualNodes: readonly VirtualNode[]
  readonly nodeIds: readonly NodeId[]
  readonly keys: readonly KeyId[]
  readonly assignment: Assignment
  readonly loads: readonly NodeLoad[]
  /** Coefficient of variation of load. Falls as virtual nodes rise. */
  readonly skew: number
  /** Fraction of keys that would move if one more node joined, via the ring. */
  readonly ringChurn: number
  /** The same, via `hash(key) % nodeCount`. This is the comparison. */
  readonly modNChurn: number
}

export const NODE_NAME_PREFIX = 'n'

function nodeNames(count: number): NodeId[] {
  return Array.from({ length: count }, (_, index) => `${NODE_NAME_PREFIX}${index + 1}`)
}

function buildRing(nodeIds: readonly NodeId[], virtualNodes: number) {
  const ring = createRing()
  nodeIds.forEach((nodeId) => ring.addNode(nodeId, virtualNodes))
  return ring
}

function assign(ring: ReturnType<typeof createRing>, keys: readonly KeyId[]): Assignment {
  const assignment = new Map<KeyId, NodeId>()

  keys.forEach((key) => {
    const owner = ring.lookup(key)
    if (owner !== undefined) {
      assignment.set(key, owner)
    }
  })

  return assignment
}

function assignByModN(keys: readonly KeyId[], nodeIds: readonly NodeId[]): Assignment {
  const assignment = new Map<KeyId, NodeId>()

  keys.forEach((key) => {
    const owner = assignModN(key, nodeIds)
    if (owner !== undefined) {
      assignment.set(key, owner)
    }
  })

  return assignment
}

function churn(before: Assignment, after: Assignment, keyCount: number): number {
  return keyCount === 0 ? 0 : diff(before, after).length / keyCount
}

export function buildRingModel(params: RingParams): RingModel {
  const nodeIds = nodeNames(params.nodeCount)
  const keys = generateKeys(createRng(params.seed), params.keyCount)

  const ring = buildRing(nodeIds, params.virtualNodes)
  const assignment = assign(ring, keys)

  // What adding one more node would cost, under each strategy. Computed rather
  // than remembered, so the comparison is available before the visitor touches
  // anything: the number is the argument, and it should not require an
  // interaction to discover.
  const grownIds = nodeNames(params.nodeCount + 1)
  const ringChurn = churn(assignment, assign(buildRing(grownIds, params.virtualNodes), keys), keys.length)
  const modNChurn = churn(
    assignByModN(keys, nodeIds),
    assignByModN(keys, grownIds),
    keys.length,
  )

  const counts = loadDistribution(assignment)
  const assigned = assignment.size

  const loads: NodeLoad[] = nodeIds.map((nodeId) => {
    const keysHeld = counts.get(nodeId) ?? 0
    return {
      nodeId,
      keys: keysHeld,
      share: assigned === 0 ? 0 : keysHeld / assigned,
    }
  })

  return {
    virtualNodes: ring.positions(),
    nodeIds,
    keys,
    assignment,
    loads,
    skew: loadSkew(assignment, nodeIds),
    ringChurn,
    modNChurn,
  }
}
