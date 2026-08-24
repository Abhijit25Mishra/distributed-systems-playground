import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  DARK_QUERY,
  THEME_STORAGE_KEY,
  ThemeContext,
  isThemePreference,
} from './themeContext'
import type { ResolvedTheme, ThemePreference } from './themeContext'

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system'
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(stored) ? stored : 'system'
  } catch {
    // Private browsing and hardened profiles throw on localStorage access.
    // A theme preference is not worth breaking the page over.
    return 'system'
  }
}

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light'
  }

  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readStoredPreference)
  const [systemResolved, setSystemResolved] = useState<ResolvedTheme>(systemTheme)

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => {
      setSystemResolved(event.matches ? 'dark' : 'light')
    }

    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const resolved: ResolvedTheme = preference === 'system' ? systemResolved : preference

  useEffect(() => {
    const root = document.documentElement

    // Only stamp data-theme for an explicit choice. Leaving the attribute off
    // under 'system' lets the prefers-color-scheme block in tokens.css own the
    // decision, which is what stops the two mechanisms fighting each other.
    if (preference === 'system') {
      delete root.dataset.theme
    } else {
      root.dataset.theme = preference
    }

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference)
    } catch {
      // Non-fatal, see readStoredPreference.
    }
  }, [preference])

  useEffect(() => {
    // The two media-scoped theme-color tags in index.html follow the OS, not
    // the toggle. Once React is running, replace them with a single tag whose
    // value is read back from --page, so the browser chrome tracks whichever
    // theme is actually on screen and there is still only one source of truth
    // for the colour.
    const page = getComputedStyle(document.documentElement).getPropertyValue('--page').trim()

    if (page === '') {
      return
    }

    document.querySelectorAll('meta[name="theme-color"]').forEach((tag) => tag.remove())

    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = page
    document.head.appendChild(meta)
  }, [resolved])

  const update = useCallback((next: ThemePreference) => {
    setPreference(next)
  }, [])

  const value = useMemo(
    () => ({ preference, resolved, setPreference: update }),
    [preference, resolved, update],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
