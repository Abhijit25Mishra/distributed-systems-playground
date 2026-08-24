import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { drawRing, prepareCanvas } from './renderer'
import { buildRingModel } from './model'
import type { RingParams } from './model'
import { useVizTokens } from '../../theme/vizTokens'
import { seriesColor } from '../../theme/vizTokens'
import type { NodeId } from './types'

/**
 * AGENT-OWNED — the interactive figure.
 *
 * Controls are plain range inputs. A simulation is product UI, not a landing
 * page: the visitor needs to know what value is set and to reach it from a
 * keyboard, which a custom-drawn slider would cost without buying anything.
 */

/**
 * Opens at 120 virtual nodes rather than 1, and the reason is measured.
 *
 * Node positions come from `hash("<nodeId>#<replica>")`, which does not depend
 * on the seed: only the keys do. So at V=1 the churn figure is a single fixed
 * draw, and for these node names it is an unlucky one. Across seeds 1, 7, 42,
 * 99, 256, 512 and 777 it reads 1.7, 1.8, 2.3, 1.3, 1.2, 2.3, 2.2 percent,
 * never near the 20% the maths predicts, because `n5` lands close behind its
 * predecessor and inherits a sliver.
 *
 * At V=120 the same seeds give 17.5 to 20.2 percent, which is the real
 * behaviour. Opening on a number that is both wrong and stable would teach the
 * wrong lesson confidently. Dragging the slider down to 1 still shows the
 * lumpiness, which is the point of virtual nodes in the first place.
 */
const DEFAULTS: RingParams = {
  nodeCount: 4,
  virtualNodes: 120,
  keyCount: 600,
  seed: 42,
}

interface RingViewProps {
  /** Hides the parameter controls. Used for the homepage figure. */
  readonly compact?: boolean
}

export function RingView({ compact = false }: RingViewProps) {
  const tokens = useVizTokens()
  const [params, setParams] = useState<RingParams>(DEFAULTS)
  const [focusedNodeId, setFocusedNodeId] = useState<NodeId | undefined>(undefined)

  const model = useMemo(() => buildRingModel(params), [params])

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
      },
      prepared.width,
      prepared.height,
    )
  }, [model, tokens, focusedNodeId])

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

  return (
    <div className={compact ? 'ringView ringView--compact' : 'ringView'}>
      <div className="ringView__stage">
        <canvas ref={canvasRef} className="ringView__canvas" role="img" aria-label={ariaLabel(model.nodeIds.length, params.virtualNodes)} />
      </div>

      <div className="ringView__side">
        <ChurnPanel ringChurn={model.ringChurn} modNChurn={model.modNChurn} />

        <LoadPanel
          loads={model.loads}
          skew={model.skew}
          tokens={tokens}
          onFocus={setFocusedNodeId}
        />

        {compact ? null : <Controls params={params} onChange={update} />}
      </div>
    </div>
  )
}

function ariaLabel(nodeCount: number, virtualNodes: number): string {
  return `Consistent hashing ring with ${nodeCount} nodes at ${virtualNodes} virtual nodes each. The load table below carries the same data.`
}

function ChurnPanel({ ringChurn, modNChurn }: { ringChurn: number; modNChurn: number }) {
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
}

interface LoadPanelProps {
  readonly loads: readonly { nodeId: NodeId; keys: number; share: number }[]
  readonly skew: number
  readonly tokens: ReturnType<typeof useVizTokens>
  readonly onFocus: (nodeId: NodeId | undefined) => void
}

function LoadPanel({ loads, skew, tokens, onFocus }: LoadPanelProps) {
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
        skew <span className="numeric">{skew.toFixed(3)}</span> — lower is more even
      </p>
    </div>
  )
}

function Controls({
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
      <Slider
        id="keys"
        label="keys"
        min={100}
        max={2000}
        step={100}
        value={params.keyCount}
        onChange={(keyCount) => onChange({ keyCount })}
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
}

interface SliderProps {
  readonly id: string
  readonly label: string
  readonly min: number
  readonly max: number
  readonly step?: number
  readonly value: number
  readonly onChange: (value: number) => void
}

function Slider({ id, label, min, max, step = 1, value, onChange }: SliderProps) {
  return (
    <div className="slider">
      <label className="slider__label" htmlFor={id}>
        <span>{label}</span>
        <output className="numeric" htmlFor={id}>
          {value}
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
      />
    </div>
  )
}
