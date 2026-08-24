import { NavLink, Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ThemeToggle } from './themeToggle'
import { VISUALIZATIONS, countByStatus } from '../content/visualizations'
import { currentChapter } from '../content/ddia'

const REPO_URL = 'https://github.com/Abhijit25Mishra/distributed-systems-playground'

const NAV_ITEMS: readonly { to: string; label: string }[] = [
  { to: '/', label: 'index' },
  { to: '/journal', label: 'journal' },
  { to: '/about', label: 'about' },
]

/**
 * AGENT-OWNED — page chrome.
 *
 * The status strip is real state read from the catalogue, not decoration: it
 * moves when a visualization ships and when a chapter is finished. A header
 * ornament that never changes is worse than no ornament.
 */
function StatusStrip() {
  const chapter = currentChapter()
  const shipped = countByStatus('live')

  return (
    <p className="siteHeader__status numeric">
      {chapter ? <span>ch.{chapter.number}</span> : null}
      <span aria-hidden="true" className="siteHeader__sep">
        ·
      </span>
      <span>
        {shipped} of {VISUALIZATIONS.length} live
      </span>
    </p>
  )
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skipLink" href="#main">
        Skip to content
      </a>

      <header className="siteHeader">
        <div className="siteHeader__inner shell">
          <Link to="/" className="siteHeader__brand" translate="no">
            DSP
            <span className="visuallyHidden">, Distributed Systems Playground, home</span>
          </Link>

          <nav className="siteHeader__nav" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  isActive ? 'siteHeader__link siteHeader__link--active' : 'siteHeader__link'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="siteHeader__meta">
            <StatusStrip />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" className="shell siteMain">
        {children}
      </main>

      <footer className="siteFooter">
        <div className="shell siteFooter__inner">
          <p className="siteFooter__note">
            Built chapter by chapter alongside <em>Designing Data-Intensive Applications</em>,
            2nd edition. Every simulation is seeded, so a URL replays exactly what its author saw.
          </p>
          <p className="siteFooter__links">
            <a href={REPO_URL} rel="noreferrer noopener" target="_blank">
              source ↗
            </a>
          </p>
        </div>
      </footer>
    </>
  )
}
