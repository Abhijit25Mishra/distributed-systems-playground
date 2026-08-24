const REPO_URL = 'https://github.com/Abhijit25Mishra/distributed-systems-playground'

/**
 * AGENT-OWNED — colophon.
 *
 * One page, no marketing voice. It answers what a cold visitor actually asks:
 * what is this, who wrote it, and can I trust what it shows me.
 */
export function AboutPage() {
  return (
    <>
      <header className="pageHead">
        <h1 className="pageHead__title">About</h1>
        <p className="pageHead__lede">
          A solo learning project, built chapter by chapter alongside Designing Data-Intensive
          Applications, 2nd edition.
        </p>
      </header>

      <div className="prose">
        <h2>What this is</h2>
        <p>
          Distributed systems papers and textbooks describe behaviour that is genuinely hard to
          hold in your head: what happens to a hash-partitioned cluster when a node leaves, why a
          tail latency that affects one request in a hundred ends up affecting most users, what an
          in-doubt participant can do once its coordinator is gone. Each visualization here takes
          one of those and makes it something you can move.
        </p>
        <p>
          The figures are not illustrations of an algorithm. They run it. Where a visualization
          shows a ring remapping keys, a real implementation is doing the mapping.
        </p>

        <h2>Determinism</h2>
        <p>
          Every simulation is driven by a seeded generator, and a run is computed in full before
          anything is drawn. Playback speed is a display concern, decoupled from the run itself,
          which is what makes scrubbing backwards possible: the run does not need to be
          regenerated, only re-read.
        </p>
        <p>
          The practical consequence is that a URL is a complete description of what you are
          looking at. Send someone a link and they see your run, not a similar one.
        </p>

        <h2>How it is built</h2>
        <p>
          Exactly two languages. Anything running in a browser is TypeScript; everything else is
          Go. The site is fully static, with no backend of any kind, and it is going to stay that
          way. Go programs run on a developer machine and publish JSON event logs the site can
          replay, or ship as a WebAssembly asset when a simulation needs to run live.
        </p>
        <p>
          There is deliberately no shared simulation engine yet. The first visualizations are
          standalone and are allowed to duplicate each other, because an engine extracted from
          three working things is a better engine than one designed before any of them existed.
          The earlier version of this repository proved the point by shipping a three-layer
          architecture and zero visualizations.
        </p>

        <h2>What is hand-written</h2>
        <p>
          The algorithms are written by hand. Consistent hashing, the storage engine, the
          consensus work, the Gossip Glomers solutions: anything where the algorithm is the
          lesson. Rendering, interface code, build configuration and tests around that hand-written
          core are not, and that boundary tightens as the project goes on.
        </p>

        <h2>Colophon</h2>
        <p>
          Geist and Geist Mono, self-hosted. React and Vite, no framework beyond that, no runtime
          CSS. Colours live in a single token file and the canvas figures read from it, so light
          and dark mode are one definition rather than eleven.
        </p>
        <p>
          The categorical palette is validated rather than chosen by eye. It clears the
          colour-vision separation thresholds in both modes, with one measured caveat: past three
          simultaneous series, no eight-hue palette can keep every pair distinguishable, so figures
          above that count label their marks directly and treat colour as a secondary cue.
        </p>
        <p>
          Source, including the plan and the journal:{' '}
          <a href={REPO_URL} rel="noreferrer noopener" target="_blank">
            github.com/Abhijit25Mishra/distributed-systems-playground ↗
          </a>
        </p>
      </div>
    </>
  )
}
