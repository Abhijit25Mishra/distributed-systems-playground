import { Link } from 'react-router-dom'
import { VISUALIZATIONS } from '../visualizations'

export function HomePage() {
  return (
    <main className="page">
      <h1>Distributed Systems Playground</h1>
      <p className="subtitle">
        Interactive visualizations of distributed systems concepts, built while reading DDIA (2nd
        edition). Deterministic simulations — same seed, same run, shareable via URL.
      </p>
      <ul className="vizList">
        {VISUALIZATIONS.map((visualization) => (
          <li key={visualization.slug} className="vizCard">
            <Link to={`/${visualization.slug}`}>
              <h2>{visualization.title}</h2>
            </Link>
            <p>{visualization.description}</p>
            {visualization.status === 'coming-soon' && <span className="badge">coming soon</span>}
          </li>
        ))}
      </ul>
    </main>
  )
}
