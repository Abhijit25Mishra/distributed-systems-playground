/**
 * HAND-WRITTEN — yours. Do not let an agent fill these in.
 *
 * The ring: a sorted set of virtual node positions over [0, 2^32), and a
 * clockwise lookup from a key's position to the first virtual node at or
 * after it.
 *
 * This is the whole algorithm. Everything else in this folder is delivery.
 */

import { hash } from './hash'
import type { NodeId, Ring, VirtualNode } from './types'

/**
 * TODO(human): implement the ring.
 *
 * Suggested internal state: a single array of VirtualNode kept **sorted by
 * position**. A sorted array is the right first choice — binary search gives
 * you lookup, and node churn is rare compared to lookups. Measure before
 * reaching for anything cleverer.
 *
 * ── addNode(nodeId, virtualNodes) ────────────────────────────────────────
 * Create `virtualNodes` positions for this node and insert them in sorted
 * order. Each replica needs a *distinct* position, so hash a distinct string
 * per replica — the convention is the node id combined with the replica
 * index, e.g. `hash(`${nodeId}#${replica}`)`. Hashing the bare node id V
 * times would give you the same position V times, which does nothing.
 *
 * ── removeNode(nodeId) ───────────────────────────────────────────────────
 * Drop every virtual node owned by that id. Three lines.
 *
 * ── lookup(key) ──────────────────────────────────────────────────────────
 * Hash the key, then find the first virtual node whose position is >= that
 * value, and return its owner.
 *
 *   ⚠️ **The wrap.** A key hashing past the *last* virtual node belongs to
 *   the *first* one — the ring is circular. Binary search will run off the
 *   end of the array here, and the fix is to wrap the index back to 0. This
 *   is the single most common bug in a consistent hashing implementation:
 *   every key in the final arc silently gets no owner, and with few keys you
 *   may not notice. There is a test aimed squarely at it.
 *
 * Return undefined when the ring is empty.
 *
 * ── note on strict TypeScript ────────────────────────────────────────────
 * `noUncheckedIndexedAccess` is on, so `array[i]` is typed `T | undefined`
 * even when you know the index is valid. You will need a guard or a
 * non-null assertion; both are fine, just be deliberate about which.
 */
export function createRing(): Ring {
  void hash

  const virtualNodes: VirtualNode[] = []
  const hashSpaceSize = 2 ** 32
  

  return {
    addNode(nodeId: NodeId, virtualNodeCount: number): void {
      for (let replica = 0; replica < virtualNodeCount; replica++) {
        const position = hash(`${nodeId}#${replica}`) % hashSpaceSize
        virtualNodes.push({ position, nodeId, replica })
      }
      virtualNodes.sort((a, b) => a.position - b.position)
     },

    removeNode(nodeId: NodeId): void {
      for (let i = virtualNodes.length - 1; i >= 0; i--) {
        const virtualNode = virtualNodes[i]
        if (virtualNode && virtualNode.nodeId === nodeId) {
          virtualNodes.splice(i, 1)
        }
      }
    },

    lookup(key) {
      if (virtualNodes.length === 0) {
        return undefined
      }

      const position = hash(key) % hashSpaceSize
      let left = 0
      let right = virtualNodes.length

      while (left < right) {
        const middle = Math.floor((left + right) / 2)
        const virtualNode = virtualNodes[middle]

        if (virtualNode && virtualNode.position < position) {
          left = middle + 1
        } else {
          right = middle
        }
      }

      const candidate = virtualNodes[left]
      if (candidate && candidate.position >= position) {
        return candidate.nodeId
      }

      return virtualNodes[0]?.nodeId
    },

    positions() {
      return virtualNodes
    },

    nodeIds() {
      return [...new Set(virtualNodes.map((virtualNode) => virtualNode.nodeId))]
    },
  }
}
