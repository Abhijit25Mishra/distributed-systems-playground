/**
 * AGENT-OWNED — logarithmic slider mapping.
 *
 * A second copy of the idea the ring's key slider uses, kept local for the
 * same reason the RNG is: no shared machinery before three visualizations
 * exist to extract it from.
 *
 * Every control here spans a range where the interesting part is the small
 * end. Fan-out matters most between 1 and 30, and a linear 1-200 track gives
 * that 15% of its length while handing the rest to numbers nobody sets. Tail
 * latency and sample count have the same shape.
 */

export const SLIDER_STEPS = 1000

export function fromSlider(position: number, min: number, max: number): number {
  const t = Math.min(Math.max(position / SLIDER_STEPS, 0), 1)
  return Math.round(min * (max / min) ** t)
}

export function toSlider(value: number, min: number, max: number): number {
  const bounded = Math.min(Math.max(value, min), max)
  return Math.round((Math.log(bounded / min) / Math.log(max / min)) * SLIDER_STEPS)
}

export const TAIL_RANGE = { min: 120, max: 4000 } as const
export const FANOUT_RANGE = { min: 1, max: 200 } as const
export const PAGES_RANGE = { min: 100, max: 5000 } as const
