/**
 * AGENT-OWNED — the routing trace, and the phase clock that replays it.
 *
 * A trace is what a single lookup *did*, decomposed far enough to animate:
 * where the key hashed to, which replica caught it, how far clockwise that
 * was, and whether the walk crossed 12 o'clock.
 *
 * It does not re-derive ownership. `ownedArcs` already encodes the rule and
 * `geometry.test.ts` cross-checks it against the hand-written `lookup`, so the
 * trace reads the answer off the same structure the picture is drawn from.
 * That coupling is deliberate: if the animation and the algorithm could ever
 * disagree, the animation would be teaching a lie convincingly.
 */

import { arcContaining, angleOf, ownedArcs } from './geometry'
import type { OwnedArc } from './geometry'
import { hash } from './hash'
import { HASH_SPACE_SIZE } from './types'
import type { KeyId, NodeId, Position, VirtualNode } from './types'

const TAU = Math.PI * 2

export interface RoutingTrace {
  readonly key: KeyId
  /** Where the key hashed to, in [0, HASH_SPACE_SIZE). */
  readonly position: Position
  /** The same value as a screen angle. */
  readonly keyAngle: number
  /** The replica the walk terminates at. */
  readonly landing: VirtualNode
  readonly landingAngle: number
  /** Clockwise distance walked, in radians. Never negative. */
  readonly sweep: number
  /**
   * Whether the walk crossed position 0. True exactly when the key hashed past
   * the last replica and wrapped to the first — the case that silently drops
   * every key in the final arc when an implementation gets it wrong.
   */
  readonly wrapped: boolean
  readonly owner: NodeId
}

export function traceRequest(
  virtualNodes: readonly VirtualNode[],
  key: KeyId,
  arcs?: readonly OwnedArc[],
): RoutingTrace | undefined {
  if (virtualNodes.length === 0) {
    return undefined
  }

  const position = hash(key) % HASH_SPACE_SIZE
  const keyAngle = angleOf(position)
  const arc = arcContaining(arcs ?? ownedArcs(virtualNodes), keyAngle)

  if (!arc) {
    return undefined
  }

  return {
    key,
    position,
    keyAngle,
    landing: arc.owner,
    landingAngle: arc.endAngle,
    sweep: (arc.endAngle - keyAngle + TAU) % TAU,
    wrapped: arc.owner.position < position,
    owner: arc.nodeId,
  }
}

/** Human-readable name of the replica a lookup landed on, e.g. "n3#41". */
export function replicaName(virtualNode: VirtualNode): string {
  return `${virtualNode.nodeId}#${virtualNode.replica}`
}

/**
 * The five phases of one request, in order.
 *
 * These exist because "the key belongs to n3" is the answer, not the argument.
 * The argument is the mechanism: a key is hashed to a *position*, which is a
 * property of the key alone and knows nothing about the cluster; and only then
 * is that position walked clockwise to whichever replica happens to be next.
 * Splitting those two steps is the entire reason adding a node moves 1/(N+1)
 * of the keys instead of nearly all of them.
 */
export type FlightPhase = 'arrive' | 'hash' | 'drop' | 'walk' | 'resolve'

interface PhaseSpan {
  readonly phase: FlightPhase
  readonly until: number
}

/**
 * Phase boundaries as cumulative fractions of one request's flight.
 *
 * `walk` gets the largest share because it is the only phase carrying an idea
 * the visitor cannot get from the static picture. `arrive` and `hash` are
 * short: they are setup, and a visitor who has seen one request already knows
 * how they end.
 */
const PHASES: readonly PhaseSpan[] = [
  { phase: 'arrive', until: 0.16 },
  { phase: 'hash', until: 0.34 },
  { phase: 'drop', until: 0.54 },
  { phase: 'walk', until: 0.86 },
  { phase: 'resolve', until: 1 },
]

export interface PhaseState {
  readonly phase: FlightPhase
  /** Progress within this phase, in [0, 1]. */
  readonly local: number
  /** Progress across the whole flight, in [0, 1]. */
  readonly overall: number
}

export function phaseAt(progress: number): PhaseState {
  const overall = clamp01(progress)
  let start = 0

  for (let i = 0; i < PHASES.length; i += 1) {
    const span = PHASES[i]
    if (!span) {
      continue
    }

    if (overall < span.until || i === PHASES.length - 1) {
      const width = span.until - start
      return {
        phase: span.phase,
        local: width === 0 ? 1 : clamp01((overall - start) / width),
        overall,
      }
    }

    start = span.until
  }

  return { phase: 'resolve', local: 1, overall }
}

/** True once the flight has reached the phase, so earlier marks stay drawn. */
export function hasReached(state: PhaseState, phase: FlightPhase): boolean {
  return PHASES.findIndex((s) => s.phase === state.phase) >= PHASES.findIndex((s) => s.phase === phase)
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * Ease-out cubic. Motion that decelerates into its target reads as arriving
 * somewhere rather than being cut off, which matters here because each phase
 * hands a position to the next one.
 */
export function easeOut(t: number): number {
  return 1 - (1 - clamp01(t)) ** 3
}
