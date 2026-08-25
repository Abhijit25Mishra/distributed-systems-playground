/**
 * AGENT-OWNED — canvas renderer for the latency explorer.
 *
 * Same two rules as every renderer here: no colour literals, everything read
 * from VizTokens so the theme toggle reaches the figure; and direct labels
 * rather than a legend, so identity never rests on colour alone.
 *
 * The x axis is logarithmic and shared by all three rows. That is the whole
 * layout decision. Latency spans three or four orders of magnitude, so a
 * linear axis would compress the median into the left edge and hand nine
 * tenths of the width to a handful of outliers. Sharing one axis across the
 * rows is what makes "the page distribution sits to the right of the call
 * distribution" something you see rather than something you are told.
 */

import { percentile } from './model'
import type { LatencyModel, Millis } from './model'
import { seriesColor } from '../../theme/vizTokens'
import type { VizTokens } from '../../theme/vizTokens'

export interface LatencyScene {
  readonly model: LatencyModel
  readonly fanOut: number
  /** The page the inspector row is showing, call by call. */
  readonly samplePage: readonly Millis[]
  /** Dims the other row. Set on hover over a percentile table row. */
  readonly focus?: 'call' | 'page' | undefined
}

const PAD_X = 14
const PAD_TOP = 10
const AXIS_HEIGHT = 26
const ROW_GAP = 14
const INSPECTOR_HEIGHT = 58
const BINS = 72
const DIM_ALPHA = 0.22
/** One row per percentile label, so three of them can never overlap. */
const LABEL_ROW_HEIGHT = 11

/**
 * Vertical space the bars get, once the three stacked label rows are
 * reserved.
 *
 * Floored, because the reservation is a fixed 39px and the row height is not:
 * on a short canvas the subtraction went negative and the bars drew upward
 * from the baseline instead of down from it. A squashed histogram is a
 * legible degradation; an inverted one is a bug that only appears on small
 * screens.
 */
function plotBandHeight(rowHeight: number): number {
  return Math.max(6, rowHeight - LABEL_ROW_HEIGHT * 3 - 6)
}

const CALL_SLOT = 0
const PAGE_SLOT = 1

interface Scale {
  readonly min: Millis
  readonly max: Millis
  readonly left: number
  readonly width: number
}

export function prepareCanvas(
  canvas: HTMLCanvasElement,
  tokens: VizTokens,
): { ctx: CanvasRenderingContext2D; width: number; height: number } | null {
  const ctx = canvas.getContext('2d')
  const rect = canvas.getBoundingClientRect()

  if (!ctx || rect.width === 0 || rect.height === 0) {
    return null
  }

  const ratio = tokens.devicePixelRatio
  const width = Math.round(rect.width * ratio)
  const height = Math.round(rect.height * ratio)

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  return { ctx, width: rect.width, height: rect.height }
}

/**
 * Axis bounds, snapped outward to whole decades.
 *
 * Snapping is what keeps the tick labels at 10ms / 100ms / 1s rather than at
 * whatever the extreme sample happened to be, and it stops the axis jittering
 * every time a slider moves by one. The top is taken from the page p99.9
 * rather than the maximum, because a single worst-ever page would otherwise
 * stretch the axis and squash everything worth reading into the left third.
 */
function scaleFor(model: LatencyModel, width: number): Scale {
  const low = percentile(model.callLatencies, 0.001)
  const high = percentile(model.pageLatencies, 0.999)

  const min = 10 ** Math.floor(Math.log10(Math.max(low, 0.5)))
  const max = 10 ** Math.ceil(Math.log10(Math.max(high, min * 10)))

  return { min, max, left: PAD_X, width: Math.max(1, width - PAD_X * 2) }
}

function xOf(scale: Scale, value: Millis): number {
  const clamped = Math.min(Math.max(value, scale.min), scale.max)
  const span = Math.log10(scale.max) - Math.log10(scale.min)
  return scale.left + ((Math.log10(clamped) - Math.log10(scale.min)) / span) * scale.width
}

export function drawLatency(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  scene: LatencyScene,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height)

  const scale = scaleFor(scene.model, width)
  const plotHeight = height - PAD_TOP - AXIS_HEIGHT - INSPECTOR_HEIGHT - ROW_GAP * 2
  const rowHeight = Math.max(30, plotHeight / 2)

  const inspectorTop = PAD_TOP
  const callTop = inspectorTop + INSPECTOR_HEIGHT + ROW_GAP
  const pageTop = callTop + rowHeight + ROW_GAP

  drawThreshold(ctx, tokens, scene, scale, PAD_TOP, pageTop + rowHeight)
  drawInspector(ctx, tokens, scene, scale, inspectorTop)

  drawHistogram(ctx, tokens, scale, {
    values: scene.model.callLatencies,
    top: callTop,
    height: rowHeight,
    slot: CALL_SLOT,
    label: 'one backend call',
    percentiles: scene.model.callPercentiles,
    dimmed: scene.focus === 'page',
  })

  drawHistogram(ctx, tokens, scale, {
    values: scene.model.pageLatencies,
    top: pageTop,
    height: rowHeight,
    slot: PAGE_SLOT,
    label: `one page, waiting on ${scene.fanOut} ${scene.fanOut === 1 ? 'call' : 'calls'}`,
    percentiles: scene.model.pagePercentiles,
    dimmed: scene.focus === 'call',
  })

  drawAxis(ctx, tokens, scale, height - AXIS_HEIGHT)
}

/** Decade ticks. A log axis with arbitrary ticks is unreadable. */
function drawAxis(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  scale: Scale,
  top: number,
): void {
  ctx.strokeStyle = tokens.axis
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(scale.left, top + 0.5)
  ctx.lineTo(scale.left + scale.width, top + 0.5)
  ctx.stroke()

  ctx.font = '10px ui-monospace, monospace'
  ctx.fillStyle = tokens.ink
  ctx.textBaseline = 'top'

  for (let decade = scale.min; decade <= scale.max; decade *= 10) {
    const x = xOf(scale, decade)
    ctx.strokeStyle = tokens.axis
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, top + 4)
    ctx.stroke()

    // The first and last labels would otherwise hang off the canvas.
    ctx.textAlign = decade === scale.min ? 'left' : decade === scale.max ? 'right' : 'center'
    ctx.fillText(axisLabel(decade), x, top + 7)
  }
}

function axisLabel(ms: Millis): string {
  if (ms < 1) {
    return `${ms}ms`
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  return `${Math.round(ms / 1000)}s`
}

/**
 * The vertical line everything is measured against, at the p99 of one call.
 *
 * Drawn in ink rather than the accent: it is an annotation, and the accent is
 * reserved for chrome. Dashed, because a solid full-height rule reads as a
 * boundary of the plot rather than as a value inside it.
 */
function drawThreshold(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  scene: LatencyScene,
  scale: Scale,
  top: number,
  bottom: number,
): void {
  const x = xOf(scale, scene.model.threshold)

  ctx.save()
  ctx.setLineDash([3, 3])
  ctx.strokeStyle = tokens.ink
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.55
  ctx.beginPath()
  ctx.moveTo(x, top)
  ctx.lineTo(x, bottom)
  ctx.stroke()
  ctx.restore()
}

/**
 * One page's calls, as dots on the shared axis, with its slowest marked.
 *
 * This row is the mechanism. The histograms below show that the page
 * distribution sits to the right of the call distribution; this shows *why*,
 * which is that a page finishes when its last call does. Everything left of
 * the marked dot arrived early and did not help.
 */
function drawInspector(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  scene: LatencyScene,
  scale: Scale,
  top: number,
): void {
  const samplePage = scene.samplePage.length > 0 ? scene.samplePage : [0]
  const samplePageLatency = Math.max(...samplePage)
  const midline = top + INSPECTOR_HEIGHT - 22

  ctx.font = '10px ui-monospace, monospace'
  ctx.fillStyle = tokens.ink
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('one page, call by call', scale.left, top)

  ctx.strokeStyle = tokens.grid
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(scale.left, midline + 0.5)
  ctx.lineTo(scale.left + scale.width, midline + 0.5)
  ctx.stroke()

  const callColor = seriesColor(tokens, CALL_SLOT)

  samplePage.forEach((latency) => {
    const x = xOf(scale, latency)
    ctx.globalAlpha = 0.5
    ctx.fillStyle = callColor
    ctx.beginPath()
    ctx.arc(x, midline, 2.5, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.globalAlpha = 1

  // The slowest call, which is the page's latency.
  const x = xOf(scale, samplePageLatency)
  ctx.beginPath()
  ctx.arc(x, midline, 6, 0, Math.PI * 2)
  ctx.fillStyle = tokens.surface
  ctx.fill()

  ctx.beginPath()
  ctx.arc(x, midline, 4, 0, Math.PI * 2)
  ctx.fillStyle = seriesColor(tokens, PAGE_SLOT)
  ctx.fill()

  ctx.strokeStyle = seriesColor(tokens, PAGE_SLOT)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, midline - 6)
  ctx.lineTo(x, midline - 14)
  ctx.stroke()

  ctx.fillStyle = seriesColor(tokens, PAGE_SLOT)
  ctx.font = '600 10px ui-monospace, monospace'
  ctx.textBaseline = 'bottom'
  ctx.textAlign = x > scale.left + scale.width * 0.8 ? 'right' : 'left'
  ctx.fillText(
    `this page waited ${formatTick(samplePageLatency)}`,
    ctx.textAlign === 'right' ? x - 4 : x + 5,
    midline - 14,
  )
}

function formatTick(ms: Millis): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`
}

interface HistogramSpec {
  readonly values: readonly Millis[]
  readonly top: number
  readonly height: number
  readonly slot: number
  readonly label: string
  readonly percentiles: { readonly p50: Millis; readonly p90: Millis; readonly p99: Millis }
  readonly dimmed: boolean
}

function drawHistogram(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  scale: Scale,
  spec: HistogramSpec,
): void {
  const baseline = spec.top + spec.height
  const color = seriesColor(tokens, spec.slot)

  ctx.globalAlpha = spec.dimmed ? DIM_ALPHA : 1

  // Bins are even in log space, matching the axis. Even in linear space they
  // would be invisibly narrow at the left and enormous at the right.
  const counts = new Array<number>(BINS).fill(0)
  const logMin = Math.log10(scale.min)
  const logSpan = Math.log10(scale.max) - logMin

  spec.values.forEach((value) => {
    const clamped = Math.min(Math.max(value, scale.min), scale.max)
    const bin = Math.min(BINS - 1, Math.floor(((Math.log10(clamped) - logMin) / logSpan) * BINS))
    counts[bin] = (counts[bin] ?? 0) + 1
  })

  const peak = Math.max(...counts, 1)
  const binWidth = scale.width / BINS

  ctx.fillStyle = color
  counts.forEach((count, index) => {
    if (count === 0) {
      return
    }
    const barHeight = (count / peak) * plotBandHeight(spec.height)
    const x = scale.left + index * binWidth
    // A 1px gap so adjacent bins stay countable instead of merging into a
    // single silhouette.
    ctx.fillRect(x, baseline - barHeight, Math.max(1, binWidth - 1), barHeight)
  })

  ctx.strokeStyle = tokens.axis
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(scale.left, baseline + 0.5)
  ctx.lineTo(scale.left + scale.width, baseline + 0.5)
  ctx.stroke()

  drawPercentileMarks(ctx, tokens, scale, spec, color)

  ctx.font = '10px ui-monospace, monospace'
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(spec.label, scale.left, spec.top)

  ctx.globalAlpha = 1
}

/**
 * p50, p90 and p99 as ticks above the baseline.
 *
 * Three and no more. p99.9 is the obvious next one and it is the first number
 * that is mostly noise at the sample sizes this figure runs at, so printing it
 * would invite reading precision that is not there.
 */
function drawPercentileMarks(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  scale: Scale,
  spec: HistogramSpec,
  color: string,
): void {
  const marks: readonly { readonly label: string; readonly value: Millis }[] = [
    { label: 'p50', value: spec.percentiles.p50 },
    { label: 'p90', value: spec.percentiles.p90 },
    { label: 'p99', value: spec.percentiles.p99 },
  ]

  const baseline = spec.top + spec.height

  marks.forEach((mark, index) => {
    const x = xOf(scale, mark.value)

    // Each label gets its own row. At high fan-out the three percentiles
    // bunch up -- p50 1.16s, p90 2.12s and p99 4.10s land within a few dozen
    // pixels of each other on a log axis -- and side by side they ran
    // together into "p50 1.16sp90 2.12s". Three marks and three rows means no
    // two can ever collide, which is cheaper and more reliable than measuring
    // and nudging them.
    const labelTop = baseline - spec.height + 10 + index * LABEL_ROW_HEIGHT

    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, baseline)
    ctx.lineTo(x, labelTop + LABEL_ROW_HEIGHT - 1)
    ctx.stroke()

    const text = `${mark.label} ${formatTick(mark.value)}`
    ctx.font = '9px ui-monospace, monospace'
    const textWidth = ctx.measureText(text).width
    const flip = x + textWidth + 6 > scale.left + scale.width
    const textX = flip ? x - 3 : x + 3

    ctx.fillStyle = tokens.surface
    ctx.fillRect(flip ? textX - textWidth : textX, labelTop, textWidth, 10)

    ctx.fillStyle = tokens.ink
    ctx.textAlign = flip ? 'right' : 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(text, textX, labelTop)
  })
}
