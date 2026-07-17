import { Link } from 'react-router-dom'
import type { Visualization } from '../visualizations'

export function ComingSoonPage({ visualization }: { visualization: Visualization }) {
  return (
    <main className="page">
      <Link to="/">&larr; all visualizations</Link>
      <h1>{visualization.title}</h1>
      <p>{visualization.description}</p>
      <p className="badge">coming soon</p>
    </main>
  )
}
