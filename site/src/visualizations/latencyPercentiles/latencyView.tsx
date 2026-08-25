import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { drawLatency, prepareCanvas } from './renderer'
import { amplification, buildLatencyModel, formatLatency, MEDIAN_CALL_MS } from './model'
import type { LatencyModel, LatencyParams } from './model'
import {
  FANOUT_RANGE,
  fromSlider,
  PAGES_RANGE,
  SLIDER_STEPS,
  TAIL_RANGE,
  toSlider,
} from './scales'
import { useVizTokens } from '../../theme/vizTokens'
import { seriesColor } from '../../theme/vizTokens'

/**
 * AGENT-OWNED — the interactive figure, algorithm included.
 *
 * See the note at the top of model.ts: the hand-written boundary was waived
 * for this one visualization at the human's request, not quietly crossed.
 */

/**
 * Defaults chosen so the headline is the one DDIA Ch 2 actually argues.
 *
 * A backend call with a 100ms median and a 1s p99 is an ordinary, healthy
 * looking service: one request in a hundred is slow. Twenty parallel calls per
 * page is a modest fan-out, well below the hundreds a real product page
 * reaches. Those two unremarkable numbers already produce 18% of pages slower
 * than the threshold, measured, against 18.2% from 1 - (1 - p)^k.
 *
 * The tail control moves p99 while the median stays pinned at 100ms, which is
 * the point: a service can look fine on a dashboard of averages and still be
 * failing a fifth of page loads.
 */
const DEFAULTS: LatencyParams = {
  callP99: 1000,
  fanOut: 20,
  pageCount: 2000,
  seed: 7,
}

/** How long the inspector holds one page before moving to the next. */
const INSPECT_HOLD_MS = 1400

interface LatencyViewProps {
  /** Hides the controls. Used for the homepage figure. */
  readonly compact?: boolean
}

export function LatencyView({ compact = false }: LatencyViewProps) {
  const tokens = useVizTokens()
  const [params, setParams] = useState<LatencyParams>(DEFAULTS)
  const [focus, setFocus] = useState<'call' | 'page' | undefined>(undefined)
  const [inspected, setInspected] = useState(0)
  const [cycling, setCycling] = useState(true)

  const model = useMemo(() => buildLatencyModel(params), [params])
  const pages = model.inspectablePages

  // Memoised so the array identity is stable between renders. Without it the
  // draw callback is rebuilt every render and the ResizeObserver effect that
  // depends on it tears down and reattaches on every tick of the sampler.
  const samplePage = useMemo(
    () => pages[inspected % Math.max(1, pages.length)] ?? [],
    [pages, inspected],
  )

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

    drawLatency(
      prepared.ctx,
      tokens,
      { model, fanOut: Math.round(params.fanOut), samplePage, focus },
      prepared.width,
      prepared.height,
    )
  }, [model, tokens, params.fanOut, samplePage, focus])

  useEffect(() => {
    render()
  }, [render])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const observer = new ResizeObserver(() => render())
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [render])

  // A timer rather than an animation frame loop: the inspector changes once
  // every 1.4 seconds, so there is nothing to interpolate and no reason to
  // wake up sixty times a second to find that out.
  useEffect(() => {
    if (!cycling || pages.length < 2) {
      return
    }

    const timer = setInterval(() => setInspected((current) => current + 1), INSPECT_HOLD_MS)
    return () => clearInterval(timer)
  }, [cycling, pages.length])

  const update = (patch: Partial<LatencyParams>) => {
    setParams((current) => ({ ...current, ...patch }))
  }

  return (
    <div className={compact ? 'latencyView latencyView--compact' : 'latencyView'}>
      <div className="latencyView__stage">
        <canvas
          ref={canvasRef}
          className="latencyView__canvas"
          role="img"
          aria-label={ariaLabel(model, Math.round(params.fanOut))}
        />

        <div className="latencyView__stageBar">
          <button
            type="button"
            className="transport__speed"
            aria-pressed={cycling}
            onClick={() => setCycling((current) => !current)}
          >
            {cycling ? 'pause sampling' : 'resume sampling'}
          </button>
          <button
            type="button"
            className="transport__speed"
            onClick={() => {
              setCycling(false)
              setInspected((current) => current + 1)
            }}
          >
            next page
          </button>
        </div>
      </div>

      <div className="latencyView__side">
        <AmplificationPanel model={model} fanOut={Math.round(params.fanOut)} tokens={tokens} />
        <PercentilePanel model={model} tokens={tokens} onFocus={setFocus} />
        {compact ? null : <Controls params={params} onChange={update} />}
      </div>
    </div>
  )
}

function ariaLabel(model: LatencyModel, fanOut: number): string {
  return (
    `Latency distributions. One backend call has a median of ` +
    `${formatLatency(model.callPercentiles.p50)} and a p99 of ` +
    `${formatLatency(model.callPercentiles.p99)}. A page waiting on ${fanOut} calls has a ` +
    `median of ${formatLatency(model.pagePercentiles.p50)}. The tables below carry the same data.`
  )
}

/**
 * The headline. Two rates against the same threshold, so the only thing that
 * differs between them is how many calls a page waits on.
 */
const AmplificationPanel = memo(function AmplificationPanel({
  model,
  fanOut,
  tokens,
}: {
  model: LatencyModel
  fanOut: number
  tokens: ReturnType<typeof useVizTokens>
}) {
  const theory = amplification(0.01, fanOut)

  return (
    <div className="panel">
      <p className="label">slower than {formatLatency(model.threshold)}</p>
      <dl className="churn">
        <div className="churn__row">
          <dt>one call</dt>
          <dd className="churn__value numeric" style={{ color: seriesColor(tokens, 0) }}>
            {(model.callExceedRate * 100).toFixed(1)}%
          </dd>
        </div>
        <div className="churn__row">
          <dt>one page</dt>
          <dd className="churn__value numeric" style={{ color: seriesColor(tokens, 1) }}>
            {(model.pageExceedRate * 100).toFixed(1)}%
          </dd>
        </div>
      </dl>
      <p className="panel__note">
        the threshold is the p99 of one call, so 1 in 100 calls is slower than it by
        definition. theory for {fanOut} {fanOut === 1 ? 'call' : 'calls'}:{' '}
        <span className="numeric">{(theory * 100).toFixed(1)}%</span>
      </p>
    </div>
  )
})

const PercentilePanel = memo(function PercentilePanel({
  model,
  tokens,
  onFocus,
}: {
  model: LatencyModel
  tokens: ReturnType<typeof useVizTokens>
  onFocus: (focus: 'call' | 'page' | undefined) => void
}) {
  const rows = [
    { key: 'call' as const, name: 'one call', slot: 0, values: model.callPercentiles },
    { key: 'page' as const, name: 'one page', slot: 1, values: model.pagePercentiles },
  ]

  return (
    <div className="panel">
      <p className="label">percentiles</p>

      <table className="loadTable">
        <caption className="visuallyHidden">
          Median, 90th and 99th percentile latency for a single backend call and for a
          whole page.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="visuallyHidden">
              measured
            </th>
            <th scope="col" className="numeric latencyTable__head">
              p50
            </th>
            <th scope="col" className="numeric latencyTable__head">
              p90
            </th>
            <th scope="col" className="numeric latencyTable__head">
              p99
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              onMouseEnter={() => onFocus(row.key)}
              onMouseLeave={() => onFocus(undefined)}
            >
              <th scope="row" className="loadTable__node">
                <span
                  className="loadTable__swatch"
                  style={{ background: seriesColor(tokens, row.slot) }}
                  aria-hidden="true"
                />
                {row.name}
              </th>
              <td className="numeric latencyTable__cell">{formatLatency(row.values.p50)}</td>
              <td className="numeric latencyTable__cell">{formatLatency(row.values.p90)}</td>
              <td className="numeric latencyTable__cell">{formatLatency(row.values.p99)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="panel__note">
        the median call never moves. everything to the right of it is the tail, and the
        page rows are what a user actually waits.
      </p>
    </div>
  )
})

const Controls = memo(function Controls({
  params,
  onChange,
}: {
  params: LatencyParams
  onChange: (patch: Partial<LatencyParams>) => void
}) {
  return (
    <div className="panel controls">
      <Slider
        id="tail"
        label={`p99 of one call (median ${MEDIAN_CALL_MS}ms)`}
        min={0}
        max={SLIDER_STEPS}
        value={toSlider(params.callP99, TAIL_RANGE.min, TAIL_RANGE.max)}
        display={formatLatency(params.callP99)}
        onChange={(position) =>
          onChange({ callP99: fromSlider(position, TAIL_RANGE.min, TAIL_RANGE.max) })
        }
      />
      <Slider
        id="fanout"
        label="calls per page"
        min={0}
        max={SLIDER_STEPS}
        value={toSlider(params.fanOut, FANOUT_RANGE.min, FANOUT_RANGE.max)}
        display={String(params.fanOut)}
        onChange={(position) =>
          onChange({ fanOut: fromSlider(position, FANOUT_RANGE.min, FANOUT_RANGE.max) })
        }
      />
      <Slider
        id="pages"
        label="pages simulated"
        min={0}
        max={SLIDER_STEPS}
        value={toSlider(params.pageCount, PAGES_RANGE.min, PAGES_RANGE.max)}
        display={String(params.pageCount)}
        onChange={(position) =>
          onChange({ pageCount: fromSlider(position, PAGES_RANGE.min, PAGES_RANGE.max) })
        }
      />
      <Slider
        id="latency-seed"
        label="seed"
        min={1}
        max={999}
        value={params.seed}
        display={String(params.seed)}
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
  readonly value: number
  readonly display: string
  readonly onChange: (value: number) => void
}

function Slider({ id, label, min, max, value, display, onChange }: SliderProps) {
  return (
    <div className="slider">
      <label className="slider__label" htmlFor={id}>
        <span>{label}</span>
        <output className="numeric" htmlFor={id}>
          {display}
        </output>
      </label>
      <input
        id={id}
        className="slider__input"
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={display}
        autoComplete="off"
      />
    </div>
  )
}
