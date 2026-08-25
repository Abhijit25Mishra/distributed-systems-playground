import { Link } from 'react-router-dom'
import { FigureFrame, PendingFigure } from '../components/figureFrame'
import { StatusBadge } from '../components/statusBadge'
import { VISUALIZATIONS } from '../content/visualizations'
import type { Visualization } from '../content/visualizations'
import { findWriteup } from '../content/writeups'
import { figureFor } from '../visualizations/registry'

/**
 * AGENT-OWNED — one page per visualization.
 *
 * Same shape whether the figure runs or not. A page that changes layout the
 * day its algorithm lands makes the unfinished ones feel like errors rather
 * than scheduled work.
 */

const SOURCE_PATHS: Readonly<Record<string, string>> = {
  'consistent-hashing': 'site/src/visualizations/consistentHashing/ring.ts',
  'latency-percentiles': 'site/src/visualizations/latencyPercentiles/model.ts',
}

function neighbours(visualization: Visualization) {
  const index = VISUALIZATIONS.findIndex((entry) => entry.slug === visualization.slug)

  return {
    previous: index > 0 ? VISUALIZATIONS[index - 1] : undefined,
    next: index < VISUALIZATIONS.length - 1 ? VISUALIZATIONS[index + 1] : undefined,
  }
}

function Metadata({ visualization }: { visualization: Visualization }) {
  const rows: readonly { label: string; value: string }[] = [
    { label: 'chapter', value: visualization.chapter },
    { label: 'plan item', value: `#${visualization.planItem}` },
    { label: 'target', value: visualization.eta },
  ]

  return (
    <dl className="metaList">
      {rows.map((row) => (
        <div key={row.label} className="metaList__row">
          <dt className="label">{row.label}</dt>
          <dd className="metaList__value">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function VisualizationPage({ visualization }: { visualization: Visualization }) {
  const writeup = findWriteup(visualization.slug)
  const { previous, next } = neighbours(visualization)
  const sourcePath = SOURCE_PATHS[visualization.slug]
  const Figure = figureFor(visualization.slug)

  return (
    <>
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/">index</Link>
        <span aria-hidden="true"> / </span>
        <span className="crumb__current">{visualization.title}</span>
      </nav>

      <header className="pageHead">
        <p className="pageHead__ordinal numeric label">
          {String(visualization.ordinal).padStart(2, '0')}
        </p>
        <h1 className="pageHead__title">{visualization.title}</h1>
        <p className="pageHead__lede">{visualization.concept}</p>
        <div className="pageHead__state">
          <StatusBadge status={visualization.status} />
        </div>
      </header>

      <FigureFrame ordinal={visualization.ordinal} caption={visualization.title}>
        {Figure ? (
          <Figure />
        ) : (
          <PendingFigure
            sourcePath={sourcePath ?? `plan item #${visualization.planItem}`}
            detail={
              sourcePath
                ? 'The algorithm is hand-written by design. This figure renders as soon as it does.'
                : `Scheduled for ${visualization.eta}, after ${visualization.chapter}.`
            }
          />
        )}
      </FigureFrame>

      <Metadata visualization={visualization} />

      <section className="section" aria-labelledby="notes-heading">
        <div className="sectionHead">
          <h2 id="notes-heading" className="sectionHead__title">
            Notes
          </h2>
        </div>

        {writeup ? (
          <div className="prose" dangerouslySetInnerHTML={{ __html: writeup }} />
        ) : (
          <p className="emptyState">
            The write-up is written after the figure works, not before. It covers what the
            algorithm does, what the design doc got wrong, and what the numbers showed.
          </p>
        )}
      </section>

      <nav className="pager" aria-label="Adjacent visualizations">
        {previous ? (
          <Link to={`/${previous.slug}`} className="pager__link pager__link--prev">
            <span className="label">previous</span>
            <span>{previous.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/${next.slug}`} className="pager__link pager__link--next">
            <span className="label">next</span>
            <span>{next.title}</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  )
}
