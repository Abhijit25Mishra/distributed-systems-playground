/**
 * AGENT-OWNED — transport controls and the step narration.
 *
 * The narration exists because the geometry stops being readable before the
 * idea does. At 16 virtual nodes the clockwise walk is about 5.6 degrees and
 * plainly visible; at 200 it is 0.45 degrees, which is honest but invisible.
 * Rather than inflate the arc and lie about the scale, the same trace is
 * written out in text, where "walk 0.4 degrees" is as legible as "walk 22
 * degrees" and the shrinking number is itself the lesson.
 */

import { HASH_SPACE_SIZE } from './types'
import { formatPosition } from './renderer'
import { replicaName } from './trace'
import type { FlightPhase, PhaseState, RoutingTrace } from './trace'
import { SPEEDS } from './timeline'
import type { Speed } from './timeline'
import { seriesColor } from '../../theme/vizTokens'
import type { VizTokens } from '../../theme/vizTokens'
import type { NodeId } from './types'

const DEGREES_PER_TURN = 360

/** Smallest walk worth printing as a number. Below this, "0.0°" would lie. */
const DEGREE_PRECISION = 0.05

function degrees(radians: number): string {
  const value = (radians * DEGREES_PER_TURN) / (Math.PI * 2)

  // A key can hash to a position a few thousand units before a replica out of
  // four billion, which is a real and interesting outcome: the walk is almost
  // nothing. Rounding it to "0.0°" reads as a broken figure rather than as a
  // near miss, so say it is small instead of saying it is zero.
  if (value > 0 && value < DEGREE_PRECISION) {
    return `<0.1°`
  }

  return `${value.toFixed(1)}°`
}

function ringDegrees(position: number): string {
  return `${((position / HASH_SPACE_SIZE) * DEGREES_PER_TURN).toFixed(1)}°`
}

interface TransportProps {
  readonly playing: boolean
  readonly cursor: number
  readonly requestCount: number
  readonly speed: Speed
  readonly onToggle: () => void
  readonly onStep: (steps: number) => void
  readonly onSeek: (cursor: number) => void
  readonly onSpeed: (speed: Speed) => void
}

export function Transport({
  playing,
  cursor,
  requestCount,
  speed,
  onToggle,
  onStep,
  onSeek,
  onSpeed,
}: TransportProps) {
  const current = Math.min(Math.floor(cursor) + 1, requestCount)

  return (
    <div className="transport">
      <div className="transport__buttons">
        <button
          type="button"
          className="transport__button"
          onClick={() => onStep(-1)}
          disabled={cursor <= 0}
          aria-label="Previous request"
        >
          <StepIcon direction="back" />
        </button>

        <button
          type="button"
          className="transport__button transport__button--primary"
          onClick={onToggle}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          type="button"
          className="transport__button"
          onClick={() => onStep(1)}
          disabled={cursor >= requestCount}
          aria-label="Next request"
        >
          <StepIcon direction="forward" />
        </button>

        <span className="transport__count numeric" aria-hidden="true">
          {current}/{requestCount}
        </span>
      </div>

      <input
        className="transport__scrub"
        type="range"
        min={0}
        max={requestCount}
        step={0.01}
        value={cursor}
        onChange={(event) => onSeek(Number(event.target.value))}
        aria-label="Seek through requests"
        aria-valuetext={`Request ${current} of ${requestCount}`}
      />

      <div className="transport__speeds" role="group" aria-label="Playback speed">
        {SPEEDS.map((option) => (
          <button
            key={option}
            type="button"
            className="transport__speed numeric"
            aria-pressed={option === speed}
            onClick={() => onSpeed(option)}
          >
            {option}x
          </button>
        ))}
      </div>
    </div>
  )
}

const STEPS: readonly { readonly phase: FlightPhase; readonly label: string }[] = [
  { phase: 'arrive', label: 'request arrives' },
  { phase: 'hash', label: 'hash the key' },
  { phase: 'drop', label: 'that is its position' },
  { phase: 'walk', label: 'walk clockwise' },
  { phase: 'resolve', label: 'first replica wins' },
]

interface TracePanelProps {
  readonly trace: RoutingTrace | undefined
  readonly phase: PhaseState
  readonly nodeIds: readonly NodeId[]
  readonly tokens: VizTokens
}

export function TracePanel({ trace, phase, nodeIds, tokens }: TracePanelProps) {
  const activeIndex = STEPS.findIndex((step) => step.phase === phase.phase)

  return (
    <div className="panel">
      <p className="label">routing one request</p>

      <ol className="trace">
        {STEPS.map((step, index) => {
          const state = traceState(index, activeIndex)

          return (
            <li key={step.phase} className="trace__step" data-state={state}>
              <span className="trace__label">{step.label}</span>
              <span className="trace__value numeric">
                {/* A step that has not happened yet shows no value. Printing
                 * the landing replica while the key is still mid-walk gives
                 * away the answer before the mechanism that produces it, which
                 * is the one thing this panel exists to show. */}
                {trace && state !== 'pending'
                  ? valueFor(step.phase, trace, nodeIds, tokens)
                  : '·'}
              </span>
            </li>
          )
        })}
      </ol>

      {trace?.wrapped ? (
        <p className="panel__note trace__wrap">
          this key hashed past the last replica, so the walk wrapped through 12 o&apos;clock
        </p>
      ) : null}

      {/* Announced only when the answer changes, not on every frame. */}
      <p className="visuallyHidden" aria-live="polite">
        {trace && phase.phase === 'resolve'
          ? `${trace.key} routed to ${trace.owner}, replica ${trace.landing.replica}`
          : ''}
      </p>
    </div>
  )
}

function traceState(index: number, activeIndex: number): 'done' | 'active' | 'pending' {
  if (index < activeIndex) {
    return 'done'
  }
  return index === activeIndex ? 'active' : 'pending'
}

function valueFor(
  phase: FlightPhase,
  trace: RoutingTrace,
  nodeIds: readonly NodeId[],
  tokens: VizTokens,
): React.ReactNode {
  switch (phase) {
    case 'arrive':
      return trace.key
    case 'hash':
      return formatPosition(trace.position)
    case 'drop':
      return ringDegrees(trace.position)
    case 'walk':
      return degrees(trace.sweep)
    case 'resolve':
      return (
        <span style={{ color: seriesColor(tokens, nodeIds.indexOf(trace.owner)) }}>
          {replicaName(trace.landing)}
        </span>
      )
  }
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
      <path d="M4 2.5 13 8l-9 5.5z" fill="currentColor" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
      <rect x="3.5" y="2.5" width="3.5" height="11" fill="currentColor" />
      <rect x="9" y="2.5" width="3.5" height="11" fill="currentColor" />
    </svg>
  )
}

function StepIcon({ direction }: { direction: 'back' | 'forward' }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      aria-hidden="true"
      focusable="false"
      style={direction === 'back' ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d="M3 3 10 8l-7 5z" fill="currentColor" />
      <rect x="11" y="3" width="2" height="10" fill="currentColor" />
    </svg>
  )
}
