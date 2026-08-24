/**
 * AGENT-OWNED — the request timeline.
 *
 * One number drives everything: a `cursor` in [0, requestCount]. Its integer
 * part is which request is in flight, its fraction is how far through that
 * flight we are. Playing advances it, scrubbing sets it, stepping rounds it.
 * Seeking backwards is therefore free and exact rather than an undo stack.
 *
 * Nothing is recorded. Every state is recomputed from the cursor, which is
 * what makes the past and the future equally reachable — and it is the same
 * property that lets a URL carry a position later.
 */

import { createRng } from './rng'
import { clamp01 } from './trace'
import type { KeyId } from './types'

/**
 * Request keys are named, unlike the background key cloud.
 *
 * The cloud uses the hand-written `generateKeys`, which returns raw floats —
 * fine for a dot, useless as a label. A request is the one key the visitor
 * actually reads, and `user:4821` says "this is a lookup for a thing" in a way
 * that `0.18998925131745636` does not. They are different objects: the cloud
 * is what is stored, a request is a question being asked about one of them.
 */
const KEY_KINDS = ['user', 'cart', 'order', 'session', 'photo', 'doc', 'inbox', 'invoice'] as const

const REQUEST_ID_MIN = 1000
const REQUEST_ID_MAX = 9999

export const DEFAULT_REQUEST_COUNT = 12

export function buildRequests(seed: number, count: number): KeyId[] {
  const rng = createRng(seed)
  const requests: KeyId[] = []

  for (let i = 0; i < count; i += 1) {
    const kind = KEY_KINDS[rng.nextInt(0, KEY_KINDS.length - 1)] ?? KEY_KINDS[0]
    requests.push(`${kind}:${rng.nextInt(REQUEST_ID_MIN, REQUEST_ID_MAX)}`)
  }

  return requests
}

export interface CursorState {
  /** Index of the request in flight, clamped into range. */
  readonly index: number
  /** Progress through that request's flight, in [0, 1]. */
  readonly progress: number
  /** Requests already fully routed, which stay marked on the ring. */
  readonly completed: number
  /** True once the cursor has run past the last request. */
  readonly finished: boolean
}

export function cursorState(cursor: number, requestCount: number): CursorState {
  if (requestCount === 0) {
    return { index: 0, progress: 0, completed: 0, finished: true }
  }

  const bounded = Math.min(Math.max(cursor, 0), requestCount)
  const finished = bounded >= requestCount
  const index = finished ? requestCount - 1 : Math.floor(bounded)

  return {
    index,
    progress: finished ? 1 : clamp01(bounded - index),
    completed: finished ? requestCount : index,
    finished,
  }
}

/** Seconds of wall clock one request's flight takes at 1x speed. */
export const SECONDS_PER_REQUEST = 2.4

export const SPEEDS = [0.5, 1, 2, 4] as const
export type Speed = (typeof SPEEDS)[number]
