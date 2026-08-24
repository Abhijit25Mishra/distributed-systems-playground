/**
 * Shared types for the consistent hashing ring.
 *
 * AGENT-OWNED — this file is scaffolding. The implementations behind these
 * interfaces are hand-written by the human (see hash.ts, rng.ts, ring.ts).
 */

/** A position on the ring, in [0, HASH_SPACE_SIZE). */
export type Position = number

/** Identifier of a physical node, e.g. "n1". */
export type NodeId = string

/** Identifier of a key being mapped, e.g. "user:4821". */
export type KeyId = string

/**
 * Size of the ring's keyspace. 2^32 is convention, not requirement — it only
 * needs to be large enough that position collisions are negligible.
 */
export const HASH_SPACE_SIZE = 2 ** 32

/**
 * One of a physical node's V positions on the ring. The ring is made of these,
 * not of nodes — a lookup lands on a virtual node and resolves to its owner.
 */
export interface VirtualNode {
  readonly position: Position
  readonly nodeId: NodeId
  /** Which replica of the owning node this is, 0-indexed. */
  readonly replica: number
}

/**
 * Seeded pseudo-random generator. One instance per run, so the same seed
 * replays byte-identically — which is what makes seeking and shareable URLs
 * work.
 */
export interface Rng {
  readonly seed: number
  /** Next float in [0, 1). Advances internal state. */
  next(): number
  /** Next integer in [min, max] inclusive. Advances internal state. */
  nextInt(min: number, max: number): number
}

/**
 * The ring itself: a sorted collection of virtual node positions over the
 * hash space, supporting clockwise lookup.
 *
 * Mutable by design. Immutability lives one level up: `buildRingModel` builds
 * a *fresh* ring for each set of control values and never mutates one in
 * place, so no ring is shared between two states the page can show.
 */
export interface Ring {
  /** Add a physical node occupying `virtualNodes` positions on the ring. */
  addNode(nodeId: NodeId, virtualNodes: number): void
  /** Remove a physical node and all of its virtual nodes. */
  removeNode(nodeId: NodeId): void
  /** Owning node for a key, or undefined when the ring is empty. */
  lookup(key: KeyId): NodeId | undefined
  /** All virtual nodes, sorted by position. For rendering. */
  positions(): readonly VirtualNode[]
  /** Physical node ids currently on the ring. */
  nodeIds(): readonly NodeId[]
}

/** Map of key to owning node at one point in a run. */
export type Assignment = ReadonlyMap<KeyId, NodeId>

/** A key that changed owner between two states. */
export interface KeyMove {
  readonly key: KeyId
  readonly from: NodeId | undefined
  readonly to: NodeId | undefined
}
