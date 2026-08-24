import { createContext, useContext } from 'react'

/**
 * AGENT-OWNED — theme context and its hook.
 *
 * Split from the provider so this module exports no components. That keeps
 * React Fast Refresh working: a file mixing a component with plain exports
 * loses its refresh boundary and forces a full reload on every edit.
 */

/**
 * Three states, not two. 'system' is a real state rather than a synonym for
 * whichever mode the OS is in right now: a visitor who has never touched the
 * toggle should follow their OS when it flips at sunset.
 */
export type ThemePreference = 'light' | 'dark' | 'system'

/** What the page is actually rendering. Never 'system'. */
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'dsp-theme'
export const DARK_QUERY = '(prefers-color-scheme: dark)'

export interface ThemeContextValue {
  readonly preference: ThemePreference
  readonly resolved: ResolvedTheme
  readonly setPreference: (next: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used inside a ThemeProvider')
  }

  return context
}
