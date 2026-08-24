import { useEffect, useState } from 'react'
import { useTheme } from './themeContext'

/**
 * AGENT-OWNED — the bridge between the CSS token layer and canvas renderers.
 *
 * A canvas has no cascade. `ctx.fillStyle` takes a colour string, and the
 * obvious thing to write is a hex literal. Do that once per visualization and
 * theming is dead: eleven renderers each holding their own private palette,
 * none of which respond to the toggle.
 *
 * So renderers never name a colour. They call readVizTokens() and paint with
 * what comes back, which means tokens.css stays the only place a hex exists,
 * and a new theme is a one-file change rather than eleven.
 *
 * The cost of doing this at visualization #1 is this file. The cost of
 * retrofitting it at visualization #5 is five renderers plus their tests.
 */

/** Fixed-order categorical slots. Assign by index, never cycle. */
export type SeriesSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/**
 * Past three simultaneous series, colour alone cannot carry identity on a
 * layout where any two marks may sit adjacent (a ring, a scatter, a map).
 * Measured against this site's surfaces with the palette validator:
 *
 *   slots 1-3, all pairs  → PASS (worst CVD dE 9.4, normal-vision dE 20.9)
 *   slots 1-4, all pairs  → FAIL (yellow vs orange, normal-vision dE 10.6)
 *   slots 1-5, all pairs  → FAIL (magenta vs aqua, deutan dE 1.6)
 *
 * Above this count the renderer MUST draw a direct label on each mark. The
 * colour becomes a secondary cue, not the identity.
 */
export const COLOR_ALONE_SERIES_LIMIT = 3

export interface VizTokens {
  /** Plot background. Matches the page surface so figures sit flush. */
  surface: string
  /** Recessive gridlines. */
  grid: string
  /** Axis and baseline strokes, one step stronger than the grid. */
  axis: string
  /** Labels, ticks, annotations inside the plot. */
  ink: string
  /** Primary ink, for a value that must dominate. */
  inkStrong: string
  /** Categorical slots 1-8, in fixed order. */
  series: readonly string[]
  /** Chrome accent. Valid for interaction affordances (a hovered mark's
   *  outline, a scrub handle) but never as a series colour. */
  accent: string
  /** Device pixel ratio at read time, for crisp canvas scaling. */
  devicePixelRatio: number
}

const SERIES_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8] as const

function readToken(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = styles.getPropertyValue(name).trim()
  return value === '' ? fallback : value
}

/**
 * Read the current token values off the document root.
 *
 * Call this inside the render/draw path, not once at module load — the values
 * change when the theme changes, and a module-level snapshot would freeze the
 * figure in whatever mode the page first loaded in.
 */
export function readVizTokens(element: Element = document.documentElement): VizTokens {
  const styles = getComputedStyle(element)

  return {
    surface: readToken(styles, '--plot-surface', '#ffffff'),
    grid: readToken(styles, '--plot-grid', '#e6e8ec'),
    axis: readToken(styles, '--plot-axis', '#c3c7cf'),
    ink: readToken(styles, '--plot-ink', '#4d525b'),
    inkStrong: readToken(styles, '--ink-primary', '#111317'),
    series: SERIES_SLOTS.map((slot) => readToken(styles, `--series-${slot}`, '#2a78d6')),
    accent: readToken(styles, '--accent', '#9a3412'),
    devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
  }
}

/**
 * Tokens for the current theme, re-read whenever the theme changes.
 *
 * Depends on `resolved` rather than reading the media query directly so that
 * both the OS preference and the manual toggle trigger a re-read.
 */
export function useVizTokens(): VizTokens {
  const { resolved } = useTheme()
  const [tokens, setTokens] = useState<VizTokens>(() => readVizTokens())

  useEffect(() => {
    // One frame of delay: the data-theme stamp and the recomputed custom
    // properties land in the same paint, and reading before that returns the
    // outgoing theme's values.
    const frame = requestAnimationFrame(() => setTokens(readVizTokens()))
    return () => cancelAnimationFrame(frame)
  }, [resolved])

  return tokens
}

/**
 * Colour for series `index` (0-based).
 *
 * Deliberately clamps instead of wrapping. Cycling would hand two different
 * entities the same colour and silently claim they are the same thing; a
 * renderer that runs out of slots should fold the remainder into "other" or
 * facet, which is a decision the caller has to make consciously.
 */
export function seriesColor(tokens: VizTokens, index: number): string {
  const slot = tokens.series[Math.min(index, tokens.series.length - 1)]
  return slot ?? tokens.series[0] ?? '#2a78d6'
}

/**
 * True when the renderer must draw direct labels because colour alone can no
 * longer distinguish the marks. See COLOR_ALONE_SERIES_LIMIT.
 */
export function requiresDirectLabels(seriesCount: number): boolean {
  return seriesCount > COLOR_ALONE_SERIES_LIMIT
}
