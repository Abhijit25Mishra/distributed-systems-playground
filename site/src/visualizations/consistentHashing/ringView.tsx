import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { drawRing, prepareCanvas } from './renderer'
import { buildRingModel } from './model'
import type { RingParams } from './model'
import { ownedArcs } from './geometry'
import { phaseAt, traceRequest } from './trace'
import type { RoutingTrace } from './trace'
import {
  buildRequests,
  cursorState,
  flightSeconds,
  keysFromSlider,
  KEY_SLIDER_STEPS,
  READABLE_FLIGHT_SECONDS,
  requestLabel,
  sliderFromKeys,
} from './timeline'
import { usePrefersReducedMotion, useThrottled, useTimeline } from './useTimeline'
import { Transport, TracePanel } from './transport'
import { useVizTokens } from '../../theme/vizTokens'
import { seriesColor } from '../../theme/vizTokens'
import type { NodeId } from './types'

/**
 * AGENT-OWNED — the interactive figure.
 *
 * Controls are plain range inputs and buttons. A simulation is product UI, not
 * a landing page: the visitor needs to know what value is set and to reach it
 * from a keyboard, which a custom-drawn slider would cost without buying
 * anything.
 */

/**
 * Both of these defaults were chosen from measured numbers, not by eye.
 *
 * ── virtualNodes: 8 ─────────────────────────────────────────────────────────
 * The animation and the statistics want opposite things, so this was picked by
 * measuring both. The right measure for the animation is not the mean arc but
 * the distribution of walks real keys actually take, in pixels at the radius
 * the figure draws at (r=145, over 3000 keys):
 *
 *     V     walk p25 / median / p75 px      churn (10 seeds)      skew
 *     4          17 /  48 / 104             31.3%  (28.8-32.9)    0.248
 *     6          12 /  37 /  76             22.0%  (19.7-23.3)    0.389
 *     8           9 /  23 /  47             19.0%  (16.4-21.1)    0.331
 *    12           6 /  14 /  30             18.9%  (16.9-20.9)    0.231
 *    16           4 /  10 /  20             23.0%  (21.5-25.6)    0.217
 *
 * V=16 was the first choice and it was wrong: a 10px median walk reads as the
 * key not having moved at all, which is precisely the step the figure exists
 * to show. V=8 doubles that to 23px and, as it happens, also has the best
 * churn of any setting tested (19.0% against a theoretical 20.0%, and the
 * tightest band across seeds). Below V=8 churn drifts badly, 31.3% at V=4.
 *
 * The walk shrinks as V rises and there is no fixing that without lying about
 * the scale. That is why the trace panel writes the same walk out in degrees,
 * where 0.4 is as readable as 22.
 *
 * ── keyCount: 2000 ──────────────────────────────────────────────────────────
 * Raised from 600 because at 600 the skew figure is mostly noise. Measured
 * against the converged value of 0.217 for this topology, the worst error
 * across ten seeds is:
 *
 *     600 keys -> 63%      1500 -> 27%      3000 -> 14%
 *    1000 keys -> 33%      2000 -> 17%      5000 ->  8%
 *
 * At 600 the number swung 0.148 to 0.355 purely on which keys were drawn,
 * which makes it a worse guide than no number at all: a visitor moving the V
 * slider would read sampling noise as a real effect. 2000 costs nothing to
 * draw now that the key dots are batched by owner.
 *
 * ── seed: 54 ────────────────────────────────────────────────────────────────
 * Chosen so the run demonstrates the wrap. A key hashing past the last replica
 * belongs to the first one, and `ring.ts` calls getting that wrong "the single
 * most common bug in a consistent hashing implementation", but a random seed
 * mostly does not produce one: of 999 seeds, only a minority yield a sample
 * containing exactly one wrap, and almost none of those also keep every walk
 * visible and visit more than two nodes.
 *
 * Seed 54 was the only seed of 999 satisfying all four: the wrap lands on
 * request 4 rather than at the end of the run, so autoplay reaches it in about
 * ten seconds; every walk is at least 10px, so none reads as the key not
 * having moved; and the twelve requests between them land on all four nodes.
 * Request 4 hashes to 359.5 degrees, a hair before 12 o'clock, and walks 25.5
 * degrees clockwise through zero to n2#4. Statistics stay unremarkable: churn
 * 21.1% against a theoretical 20.0%, skew 0.371 against 1/sqrt(8) = 0.354.
 *
 * This is choosing which example to show, not changing what happens. Every
 * key is hashed and routed by the same code at any seed; drag the slider and
 * the wrap usually disappears, which is itself worth seeing.
 *
 * ── the caveat that survives both ───────────────────────────────────────────
 * Node positions come from hash("n1#0") and do not depend on the seed, so the
 * seed slider re-rolls the keys but never the topology. Across 40 independent
 * topologies the true skew at a single V spans roughly a factor of five; this
 * one sits at 0.371 for V=8 against a theoretical 0.354. The figure shows one
 * ring, not the average of all rings.
 */
const DEFAULTS: RingParams = {
  nodeCount: 4,
  virtualNodes: 8,
  keyCount: 2000,
  seed: 54,
}

/** How long the narration holds one key when flights are too fast to read. */
const NARRATION_HOLD_MS = 220

interface RingViewProps {
  /** Hides the parameter controls and the step narration. Homepage figure. */
  readonly compact?: boolean
}

export function RingView({ compact = false }: RingViewProps) {
  const tokens = useVizTokens()
  const [params, setParams] = useState<RingParams>(DEFAULTS)
  const [hoveredNodeId, setHoveredNodeId] = useState<NodeId | undefined>(undefined)

  const reducedMotion = usePrefersReducedMotion()
  const model = useMemo(() => buildRingModel(params), [params])

  // Every key on the ring, not a sample of them. The figure routes exactly
  // what it claims to be showing.
  const requests = useMemo(() => buildRequests(model.keys), [model.keys])

  const pace = flightSeconds(requests.length)
  const timeline = useTimeline(requests.length, pace, !reducedMotion)
  const state = cursorState(timeline.cursor, requests.length)
  const phase = phaseAt(state.progress)

  // Arcs are shared by every trace at this topology, so they are computed once
  // per model rather than once per request.
  const arcs = useMemo(() => ownedArcs(model.virtualNodes), [model.virtualNodes])

  const request = requests[state.index]

  // One trace, for the key in flight. Tracing all of them up front was fine at
  // twelve and is 2000 x 1600 arc comparisons at the top of both sliders, on
  // every parameter change.
  const trace: RoutingTrace | undefined = useMemo(
    () => (request ? traceRequest(model.virtualNodes, request.key, arcs) : undefined),
    [request, model.virtualNodes, arcs],
  )

  const inFlight = trace !== undefined && request !== undefined && !state.finished

  // Below half a second a flight is not five readable steps, so the narration
  // stops animating them and reports whichever key it caught, a few times a
  // second. Without this the panel rewrites forty times a second at 2000 keys.
  const settled = pace < READABLE_FLIGHT_SECONDS
  const narrated = useThrottled(
    useMemo(() => ({ trace, request }), [trace, request]),
    settled ? NARRATION_HOLD_MS : 0,
  )

  // Isolating the owner at the moment of resolution is the payoff of the whole
  // flight: the answer is not just "this replica" but "therefore this node,
  // and these are all the other places it sits on the ring".
  //
  // Gated on the run still being live. A finished run sits at progress 1,
  // which is inside the resolve phase, so without this the figure stayed
  // dimmed onto the last node it happened to touch and never came back --
  // leaving the resting state of the whole visualization a greyed-out ring
  // highlighting an arbitrary node.
  const focusedNodeId =
    hoveredNodeId ?? (inFlight && phase.phase === 'resolve' ? trace?.owner : undefined)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const prepared = prepareCanvas(canvas, tokens)
    if (!prepared) {
      return
    }

    drawRing(
      prepared.ctx,
      tokens,
      {
        virtualNodes: model.virtualNodes,
        nodeIds: model.nodeIds,
        keys: model.keys,
        assignment: model.assignment,
        focusedNodeId,
        focusStrength: hoveredNodeId === undefined ? 'soft' : 'strong',
        flight:
          inFlight && trace && request ? { trace, phase, label: requestLabel(request) } : undefined,
      },
      prepared.width,
      prepared.height,
    )
  }, [model, tokens, focusedNodeId, hoveredNodeId, inFlight, trace, request, phase])

  useEffect(() => {
    render()
  }, [render])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    // The canvas is sized by CSS, so a layout change needs a redraw at the new
    // backing-store size. A window resize listener would miss container-only
    // changes such as the sidebar collapsing at a breakpoint.
    const observer = new ResizeObserver(() => render())
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [render])

  const update = (patch: Partial<RingParams>) => {
    setParams((current) => ({ ...current, ...patch }))
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Buttons and the scrubber own these keys already; intercepting them here
    // too would fire the action twice.
    if (event.target !== event.currentTarget) {
      return
    }

    if (event.key === ' ') {
      event.preventDefault()
      timeline.toggle()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      timeline.stepBy(-1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      timeline.stepBy(1)
    }
  }

  return (
    <div className={compact ? 'ringView ringView--compact' : 'ringView'}>
      <div
        className="ringView__stage"
        tabIndex={0}
        role="group"
        aria-label="Ring figure. Press space to play or pause, arrow keys to step between requests."
        onKeyDown={onKeyDown}
      >
        <canvas
          ref={canvasRef}
          className="ringView__canvas"
          role="img"
          aria-label={ariaLabel(model.nodeIds.length, params.virtualNodes)}
        />

        <Transport
          playing={timeline.playing}
          cursor={timeline.cursor}
          requestCount={requests.length}
          speed={timeline.speed}
          onToggle={timeline.toggle}
          onStep={timeline.stepBy}
          onSeek={timeline.seek}
          onSpeed={timeline.setSpeed}
        />
      </div>

      <div className="ringView__side">
        {compact ? null : (
          <TracePanel
            trace={narrated.trace}
            request={narrated.request}
            phase={phase}
            settled={settled}
            nodeIds={model.nodeIds}
            tokens={tokens}
          />
        )}

        <ChurnPanel ringChurn={model.ringChurn} modNChurn={model.modNChurn} />

        <LoadPanel
          loads={model.loads}
          skew={model.skew}
          tokens={tokens}
          onFocus={setHoveredNodeId}
        />

        {compact ? null : <Controls params={params} onChange={update} />}
      </div>
    </div>
  )
}

function ariaLabel(nodeCount: number, virtualNodes: number): string {
  return `Consistent hashing ring with ${nodeCount} nodes at ${virtualNodes} virtual nodes each. The load table below carries the same data.`
}

/**
 * Memoised, all three of them. The cursor changes sixty times a second during
 * playback and none of these depend on it, so without this every frame would
 * reconcile a table and a set of sliders to produce identical output.
 */
const ChurnPanel = memo(function ChurnPanel({
  ringChurn,
  modNChurn,
}: {
  ringChurn: number
  modNChurn: number
}) {
  return (
    <div className="panel">
      <p className="label">if one more node joins</p>
      <dl className="churn">
        <div className="churn__row">
          <dt>this ring</dt>
          <dd className="churn__value churn__value--good numeric">
            {(ringChurn * 100).toFixed(1)}%
          </dd>
        </div>
        <div className="churn__row">
          <dt>hash % N</dt>
          <dd className="churn__value churn__value--bad numeric">
            {(modNChurn * 100).toFixed(1)}%
          </dd>
        </div>
      </dl>
      <p className="panel__note">of all keys change owner</p>
    </div>
  )
})

interface LoadPanelProps {
  readonly loads: readonly { nodeId: NodeId; keys: number; share: number }[]
  readonly skew: number
  readonly tokens: ReturnType<typeof useVizTokens>
  readonly onFocus: (nodeId: NodeId | undefined) => void
}

const LoadPanel = memo(function LoadPanel({ loads, skew, tokens, onFocus }: LoadPanelProps) {
  const widest = Math.max(...loads.map((load) => load.share), 0.0001)

  return (
    <div className="panel">
      <p className="label">keys per node</p>

      <table className="loadTable">
        <caption className="visuallyHidden">
          Keys held by each node, and each node&apos;s share of the total.
        </caption>
        <thead className="visuallyHidden">
          <tr>
            <th scope="col">Node</th>
            <th scope="col">Keys</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {loads.map((load, index) => (
            <tr
              key={load.nodeId}
              onMouseEnter={() => onFocus(load.nodeId)}
              onMouseLeave={() => onFocus(undefined)}
            >
              <th scope="row" className="loadTable__node">
                <span
                  className="loadTable__swatch"
                  style={{ background: seriesColor(tokens, index) }}
                  aria-hidden="true"
                />
                {load.nodeId}
              </th>
              <td className="loadTable__bar">
                <span
                  className="loadTable__fill"
                  style={{
                    width: `${(load.share / widest) * 100}%`,
                    background: seriesColor(tokens, index),
                  }}
                />
              </td>
              <td className="loadTable__count numeric">{load.keys}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="panel__note">
        skew <span className="numeric">{skew.toFixed(3)}</span> - lower is more even
      </p>
    </div>
  )
})

const Controls = memo(function Controls({
  params,
  onChange,
}: {
  params: RingParams
  onChange: (patch: Partial<RingParams>) => void
}) {
  return (
    <div className="panel controls">
      <Slider
        id="nodes"
        label="nodes"
        min={1}
        max={8}
        value={params.nodeCount}
        onChange={(nodeCount) => onChange({ nodeCount })}
      />
      <Slider
        id="vnodes"
        label="virtual nodes each"
        min={1}
        max={200}
        value={params.virtualNodes}
        onChange={(virtualNodes) => onChange({ virtualNodes })}
      />
      {/* Logarithmic. A linear 1-2000 track gives the first ten keys 0.5% of
        * its length, about two pixels, so the range where the mechanism is
        * followable one key at a time is unreachable. By ratio instead, 31% of
        * the travel covers 1-10 keys and 40% covers 1-20. */}
      <Slider
        id="keys"
        label="keys"
        min={0}
        max={KEY_SLIDER_STEPS}
        value={sliderFromKeys(params.keyCount)}
        display={params.keyCount}
        onChange={(position) => onChange({ keyCount: keysFromSlider(position) })}
      />
      <Slider
        id="seed"
        label="seed"
        min={1}
        max={999}
        value={params.seed}
        onChange={(seed) => onChange({ seed })}
      />
    </div>
  )
})

interface SliderProps {
  readonly id: string
  readonly label: string
  readonly min: number
  readonly max: number
  readonly step?: number
  readonly value: number
  /** Shown instead of `value` when the track is a scale rather than the number. */
  readonly display?: number
  readonly onChange: (value: number) => void
}

function Slider({ id, label, min, max, step = 1, value, display, onChange }: SliderProps) {
  const shown = display ?? value
  return (
    <div className="slider">
      <label className="slider__label" htmlFor={id}>
        <span>{label}</span>
        <output className="numeric" htmlFor={id}>
          {shown}
        </output>
      </label>
      <input
        id={id}
        className="slider__input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={String(shown)}
        /* Browsers restore form-control values across a reload and feed them
         * back through input events, which React accepts -- so reloading the
         * page silently replaced the chosen defaults with whatever the sliders
         * were last dragged to. The defaults here are measured and documented;
         * a reload should show them. */
        autoComplete="off"
      />
    </div>
  )
}
