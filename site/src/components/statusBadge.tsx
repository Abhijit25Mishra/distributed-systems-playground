import { STATUS_LABEL } from '../content/visualizations'
import type { VisualizationStatus } from '../content/visualizations'

/**
 * AGENT-OWNED.
 *
 * Text, not a coloured dot. State is spelled out and the colour only
 * reinforces it, so the badge still works for a colourblind reader, in
 * forced-colors mode, and in a greyscale screenshot. A bare dot would fail
 * all three.
 */
export function StatusBadge({ status }: { status: VisualizationStatus }) {
  return (
    <span className={`statusBadge statusBadge--${status}`} data-status={status}>
      {STATUS_LABEL[status]}
    </span>
  )
}
