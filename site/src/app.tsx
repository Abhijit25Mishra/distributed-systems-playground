import { Route, Routes } from 'react-router-dom'
import { VISUALIZATIONS } from './visualizations'
import { HomePage } from './pages/homePage'
import { ComingSoonPage } from './pages/comingSoonPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {VISUALIZATIONS.map((visualization) => (
        <Route
          key={visualization.slug}
          path={`/${visualization.slug}`}
          element={<ComingSoonPage visualization={visualization} />}
        />
      ))}
    </Routes>
  )
}
