/**
 * AGENT-OWNED — the request timeline.
 *
 * One number drives everything: a `cursor` in [0, keyCount]. Its integer part
 * is which key is being routed, its fraction is how far through that routing
 * we are. Playing advances it, scrubbing sets it, stepping rounds it. Seeking
 * backwards is therefore free and exact rather than an undo stack.
 *
 * Nothing is recorded. Every state is recomputed from the cursor, which is
 * what makes the past and the future equally reachable.
 */

import { clamp01 } from './trace'
import type { KeyId } from './types'

export interface Request {
  readonly key: KeyId
  /** 1-based position in the key set. */
  readonly ordinal: number
  /** Total keys on the ring. Equal to the number of requests. */
  readonly outOf: number
}

/**
 * Every key on the ring, in order, as something to route.
 *
 * There is no sampling here and there deliberately is not. Two earlier
 * versions animated a fixed twelve: first twelve invented keys that were not
 * in the set at all, then twelve drawn from it. Both left the figure saying
 * "2000 keys" while showing twelve of something, and the second was only less
 * wrong than the first. If the figure claims N keys it routes N keys, and the
 * question "why twelve" cannot arise.
 *
 * This is what makes the key slider the main control: at 8 keys the run is
 * eight flights you can follow individually, and at 2000 it is a stream that
 * fills the ring. Same code, same claim, no arithmetic to reconcile.
 */
export function buildRequests(keys: readonly KeyId[]): Request[] {
  return keys.map((key, index) => ({ key, ordinal: index + 1, outOf: keys.length }))
}

/** Label tying a request back to the dot it is, e.g. "key 1483". */
export function requestLabel(request: Request): string {
  return `key ${request.ordinal}`
}

/** Seconds one key's flight takes at 1x when there is time to watch it. */
export const FULL_FLIGHT_SECONDS = 2.4

/** Floor, so two thousand keys do not take eighty minutes. */
const MIN_FLIGHT_SECONDS = 0.025

/** Roughly how long a whole run should take once flights start compressing. */
const TARGET_RUN_SECONDS = 30

/**
 * How long one key gets, given how many there are.
 *
 * A fixed pace cannot serve both ends of the slider. At 2.4 seconds each, the
 * five phases are separately readable and eight keys take twenty seconds; two
 * thousand keys take eighty minutes. At a fixed fast pace, 2000 keys stream
 * past nicely and a single key is over before it is seen.
 *
 * So the pace is derived from the count: full speed while a run fits in about
 * half a minute, compressing after that, floored so the longest run is under a
 * minute. The phases do not disappear as it compresses, they just stop being
 * separately readable, which is the honest thing for them to do -- at two
 * thousand keys the interesting object is the distribution, not any one walk.
 */
export function flightSeconds(count: number): number {
  if (count <= 0) {
    return FULL_FLIGHT_SECONDS
  }

  return Math.min(
    FULL_FLIGHT_SECONDS,
    Math.max(MIN_FLIGHT_SECONDS, TARGET_RUN_SECONDS / count),
  )
}

/**
 * Below this, one flight is too brief to read as five steps, so the narration
 * stops trying to animate them and just reports the key it caught.
 */
export const READABLE_FLIGHT_SECONDS = 0.5

export interface CursorState {
  /** Index of the key being routed, clamped into range. */
  readonly index: number
  /** Progress through that key's flight, in [0, 1]. */
  readonly progress: number
  /** Keys already fully routed. */
  readonly completed: number
  /** True once the cursor has run past the last key. */
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

/**
 * Playback rates, spanning six doublings.
 *
 * The range is wide because the figure is two different things at its two
 * ends. At a handful of keys, 0.125x stretches one flight to nineteen seconds,
 * which is what studying a single walk needs. At two thousand, 8x turns a
 * fifty-second stream into six. Powers of two so the steps are legible.
 */
export const SPEEDS = [0.125, 0.25, 0.5, 1, 2, 4, 8] as const
export type Speed = (typeof SPEEDS)[number]

/* ── the key-count slider ──────────────────────────────────────────────────
 *
 * Logarithmic, because the interesting range is not where a linear slider puts
 * it. Understanding starts at a handful of keys you can count, and a linear
 * 1-2000 track spends 0.5% of its length on the first ten -- about two pixels,
 * unhittable. Spacing the track by ratio instead:
 *
 *     0%    1        30%   10        60%   96        90%   935
 *     10%   2        40%   21        70%   205       100%  2000
 *     20%   5        50%   45        80%   437
 *
 * which puts 31% of the travel on 1-10 keys, 40% on 1-20, and 61% on 1-100.
 * The dense end still reaches 2000, it just stops occupying the whole bar.
 */

export const MIN_KEYS = 1
export const MAX_KEYS = 2000
export const KEY_SLIDER_STEPS = 1000

export function keysFromSlider(position: number): number {
  const t = clamp01(position / KEY_SLIDER_STEPS)
  return Math.round(MIN_KEYS * (MAX_KEYS / MIN_KEYS) ** t)
}

export function sliderFromKeys(keys: number): number {
  const bounded = Math.min(Math.max(keys, MIN_KEYS), MAX_KEYS)
  const t = Math.log(bounded / MIN_KEYS) / Math.log(MAX_KEYS / MIN_KEYS)
  return Math.round(t * KEY_SLIDER_STEPS)
}
