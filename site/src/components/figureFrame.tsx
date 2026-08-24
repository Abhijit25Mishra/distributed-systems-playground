import { Component } from 'react'
import type { CSSProperties, ErrorInfo, ReactNode } from 'react'

/**
 * AGENT-OWNED — the standard container every visualization renders into.
 *
 * One frame, used identically on the homepage and on a visualization page, so
 * a figure reads the same wherever it appears and the surrounding page never
 * has to know what is inside it.
 */

interface FigureFrameProps {
  /** Zero-padded on display. Gives figures a stable citation in write-ups. */
  readonly ordinal: number
  readonly caption: string
  /** Width / height. Wider than tall by default; figures are read, not scrolled. */
  readonly aspect?: string
  readonly children: ReactNode
  /** Rendered under the caption: controls, seed, node count. */
  readonly footer?: ReactNode
}

export function FigureFrame({ ordinal, caption, aspect = '16 / 9', children, footer }: FigureFrameProps) {
  // Passed as a custom property rather than `style={{ aspectRatio }}`. An
  // inline aspect-ratio beats every stylesheet rule no matter its
  // specificity, which would stop the empty-frame rule in layout.css from
  // collapsing the 16:9 void down to a band.
  const plotStyle = { '--figure-aspect': aspect } as CSSProperties

  return (
    <figure className="figure">
      <div className="figure__plot" style={plotStyle}>
        <FigureBoundary caption={caption}>{children}</FigureBoundary>
      </div>

      <figcaption className="figure__caption">
        <span className="figure__ordinal numeric">Fig. {String(ordinal).padStart(2, '0')}</span>
        <span className="figure__captionText">{caption}</span>
      </figcaption>

      {footer ? <div className="figure__footer">{footer}</div> : null}
    </figure>
  )
}

/**
 * The state a figure sits in before its algorithm exists.
 *
 * Deliberately names the file and what is missing rather than saying "coming
 * soon". While a visualization is being built this doubles as a progress
 * readout, and it is honest in a way a mocked-up screenshot is not: nothing
 * here pretends to be a working simulation.
 */
export function PendingFigure({ sourcePath, detail }: { sourcePath: string; detail?: string }) {
  return (
    <div className="figurePending">
      <p className="label">not yet implemented</p>
      <p className="figurePending__detail">
        {detail ?? 'The algorithm behind this figure has not been written yet.'}
      </p>
      {/* A file path is an identifier, not prose. Auto-translate mangles it. */}
      <code className="figurePending__path" translate="no">
        {sourcePath}
      </code>
    </div>
  )
}

interface BoundaryProps {
  readonly caption: string
  readonly children: ReactNode
}

interface BoundaryState {
  readonly message: string | null
}

/**
 * A visualization whose algorithm is still a `TODO(human)` stub throws when
 * it is called. That is correct behaviour for the stub, but it must not take
 * the page down with it: one unimplemented figure should degrade to a labelled
 * placeholder, not a blank homepage.
 */
class FigureBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { message: null }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { message: error instanceof Error ? error.message : 'Figure failed to render' }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Surfaced rather than swallowed: a figure that silently shows a
    // placeholder when it should be drawing is a bug that hides itself.
    console.error(`Figure "${this.props.caption}" failed to render`, error, info.componentStack)
  }

  override render(): ReactNode {
    if (this.state.message !== null) {
      return (
        <div className="figurePending">
          <p className="label">figure unavailable</p>
          <p className="figurePending__detail">{this.state.message}</p>
        </div>
      )
    }

    return this.props.children
  }
}
