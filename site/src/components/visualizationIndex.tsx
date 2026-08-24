import { Link } from 'react-router-dom'
import { StatusBadge } from './statusBadge'
import { VISUALIZATIONS } from '../content/visualizations'
import type { Visualization } from '../content/visualizations'

/**
 * AGENT-OWNED — the index.
 *
 * Rules with hairlines, not a grid of cards. Cards imply each entry is a
 * self-contained object of equal weight; these are ordered stops on a
 * timeline, and a ruled list says that without needing a caption to explain
 * it. It also puts eleven entries on screen at once, which a card grid cannot.
 */

function IndexRow({ visualization }: { visualization: Visualization }) {
  const ordinal = String(visualization.ordinal).padStart(2, '0')

  return (
    <li className="indexRow">
      <Link to={`/${visualization.slug}`} className="indexRow__link">
        <span className="indexRow__ordinal numeric" aria-hidden="true">
          {ordinal}
        </span>

        <span className="indexRow__body">
          <span className="indexRow__title">{visualization.title}</span>
          <span className="indexRow__summary">{visualization.summary}</span>
        </span>

        <span className="indexRow__chapter">{visualization.chapter}</span>

        <span className="indexRow__state">
          {/* 'planned' is the default state of every row, so printing it ten
              times down the right-hand column says nothing. Only the
              exceptions get a badge; the date carries the rest. */}
          {visualization.status !== 'planned' ? (
            <StatusBadge status={visualization.status} />
          ) : null}
          <span className="indexRow__eta numeric">{visualization.eta}</span>
        </span>
      </Link>
    </li>
  )
}

export function VisualizationIndex({ omitSlug }: { omitSlug?: string }) {
  const entries = VISUALIZATIONS.filter((visualization) => visualization.slug !== omitSlug)

  return (
    <ul className="indexList">
      {entries.map((visualization) => (
        <IndexRow key={visualization.slug} visualization={visualization} />
      ))}
    </ul>
  )
}
