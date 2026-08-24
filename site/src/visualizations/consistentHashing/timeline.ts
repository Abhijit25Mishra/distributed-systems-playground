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

import { clamp01 } from './trace'
import type { KeyId } from './types'

export const DEFAULT_REQUEST_COUNT = 12

export interface Request {
  readonly key: KeyId
  /** 1-based position in the key set. */
  readonly ordinal: number
  /** Total keys the sample was drawn from. */
  readonly outOf: number
}

/**
 * The requests to animate, drawn from the keys the figure is already showing.
 *
 * This used to invent its own keys with readable names -- `cart:9918` and so
 * on -- while the cloud behind them held a different two thousand keys that
 * shared nothing with them. The figure therefore claimed a scale and then
 * animated twelve things that were not part of it, and the two populations
 * were even drawn at different radii, so they read as different kinds of
 * object. That is incoherent whether or not anyone notices the arithmetic.
 *
 * Now a request is one of the keys on screen, and its label says which one, so
 * "this is what happened to all two thousand" is something the visitor can
 * check rather than take on faith.
 *
 * Sampled at even intervals rather than randomly: indices carry no relation to
 * ring position, so evenly spaced indices give a well spread set of positions
 * while staying reproducible and covering the whole set rather than clustering
 * in whatever region a small random draw happened to favour.
 */
export function sampleRequests(keys: readonly KeyId[], count: number): Request[] {
  if (keys.length === 0 || count <= 0) {
    return []
  }

  const wanted = Math.min(count, keys.length)
  const requests: Request[] = []

  for (let i = 0; i < wanted; i += 1) {
    const index = Math.floor(((i + 0.5) * keys.length) / wanted)
    const key = keys[Math.min(index, keys.length - 1)]

    if (key !== undefined) {
      requests.push({ key, ordinal: index + 1, outOf: keys.length })
    }
  }

  return requests
}

/** Label tying a request back to the dot it is, e.g. "key 1483". */
export function requestLabel(request: Request): string {
  return `key ${request.ordinal}`
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
