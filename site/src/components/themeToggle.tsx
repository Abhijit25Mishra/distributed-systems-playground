import { useTheme } from '../theme/themeContext'
import type { ThemePreference } from '../theme/themeContext'


/**
 * AGENT-OWNED.
 *
 * Three states rendered as three labelled buttons rather than a sun/moon
 * glyph. A two-state icon toggle cannot express "follow the system", and it
 * cannot tell you which state you are currently in without the user learning
 * whether the icon shows the current mode or the one it switches to. Text
 * removes both problems, and a labelled control suits the rest of the page.
 */

const OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'light' },
  { value: 'dark', label: 'dark' },
  { value: 'system', label: 'auto' },
]

export function ThemeToggle() {
  const { preference, setPreference } = useTheme()

  return (
    <div className="themeToggle" role="group" aria-label="Colour theme">
      {OPTIONS.map((option) => {
        const isActive = preference === option.value

        return (
          <button
            key={option.value}
            type="button"
            className="themeToggle__option"
            aria-pressed={isActive}
            onClick={() => setPreference(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
