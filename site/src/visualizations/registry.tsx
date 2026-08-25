import type { ComponentType } from 'react'
import { RingView } from './consistentHashing/ringView'
import { LatencyView } from './latencyPercentiles/latencyView'

/**
 * AGENT-OWNED — maps a slug to its figure.
 *
 * A slug with no entry renders the pending frame instead, so a visualization
 * appears on the site the moment its component is registered and needs no
 * other change. Deliberately a flat map rather than a lazy import: the whole
 * site is one small bundle today, and code splitting before there is anything
 * to split is the mistake this repo already made once.
 */

export interface FigureProps {
  readonly compact?: boolean
}

export const FIGURES: Readonly<Record<string, ComponentType<FigureProps>>> = {
  'consistent-hashing': RingView,
  'latency-percentiles': LatencyView,
}

export function figureFor(slug: string): ComponentType<FigureProps> | undefined {
  return FIGURES[slug]
}
