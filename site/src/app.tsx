import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { SiteShell } from './components/siteShell'
import { ThemeProvider } from './theme/themeProvider'
import { VISUALIZATIONS } from './content/visualizations'
import { HomePage } from './pages/homePage'
import { VisualizationPage } from './pages/visualizationPage'
import { JournalEntryPage, JournalIndexPage } from './pages/journalPages'
import { AboutPage } from './pages/aboutPage'
import { NotFoundPage } from './pages/notFoundPage'

/**
 * Visualization routes are enumerated from the catalogue rather than matched
 * with a `/:slug` wildcard. An unknown slug then falls through to the 404
 * instead of rendering an empty page for a URL that never existed.
 */
function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    // 'instant' rather than the document's smooth behaviour: a route change
    // is a new page, and animating to the top of it just delays reading.
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

export function App() {
  return (
    <ThemeProvider>
      <ScrollToTop />
      <SiteShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/journal" element={<JournalIndexPage />} />
          <Route path="/journal/:date" element={<JournalEntryPage />} />
          <Route path="/about" element={<AboutPage />} />
          {VISUALIZATIONS.map((visualization) => (
            <Route
              key={visualization.slug}
              path={`/${visualization.slug}`}
              element={<VisualizationPage visualization={visualization} />}
            />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </SiteShell>
    </ThemeProvider>
  )
}
