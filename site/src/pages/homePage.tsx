import { Link } from 'react-router-dom'
import { FigureFrame, PendingFigure } from '../components/figureFrame'
import { VisualizationIndex } from '../components/visualizationIndex'
import { StatusBadge } from '../components/statusBadge'
import { featuredVisualization } from '../content/visualizations'
import { ChapterProgress } from '../components/chapterProgress'
import { figureFor } from '../visualizations/registry'

/**
 * AGENT-OWNED — homepage.
 *
 * The featured figure is the hero. Not a screenshot of one, not a mock built
 * from styled divs: the same component the visualization page renders, in the
 * same frame. Until its algorithm exists the frame shows what is missing and
 * names the file, which is honest and doubles as a build readout.
 */
export function HomePage() {
  const featured = featuredVisualization()
  const Figure = figureFor(featured.slug)

  return (
    <>
      <section className="masthead">
        <h1 className="masthead__title">Distributed systems, one figure at a time.</h1>
        <p className="masthead__lede">
          Interactive simulations built alongside DDIA. Every run is seeded, so a URL replays
          exactly what you saw.
        </p>
      </section>

      <section className="featured" aria-labelledby="featured-heading">
        {/* Ahead of the figure so the heading order matches the DOM order a
            screen reader walks. */}
        <h2 id="featured-heading" className="visuallyHidden">
          Currently building: {featured.title}
        </h2>

        <FigureFrame
          ordinal={featured.ordinal}
          caption={featured.title}
          footer={
            <div className="featured__meta">
              <p className="featured__concept">{featured.concept}</p>
              <div className="featured__actions">
                <StatusBadge status={featured.status} />
                <Link to={`/${featured.slug}`} className="button">
                  Open the ring
                </Link>
              </div>
            </div>
          }
        >
          {Figure ? (
            <Figure compact />
          ) : (
            <PendingFigure
              sourcePath="site/src/visualizations/consistentHashing/ring.ts"
              detail="The ring is hand-written by design. This frame renders the moment addNode, removeNode and lookup return instead of throwing."
            />
          )}
        </FigureFrame>
      </section>

      <section className="section" aria-labelledby="index-heading">
        <div className="sectionHead">
          <h2 id="index-heading" className="sectionHead__title">
            Everything else
          </h2>
          <p className="sectionHead__note">ordered by planned ship date</p>
        </div>
        <VisualizationIndex omitSlug={featured.slug} />
      </section>

      <ChapterProgress />
    </>
  )
}
