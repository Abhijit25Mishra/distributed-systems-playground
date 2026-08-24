/**
 * AGENT-OWNED — canvas renderer for the ring.
 *
 * Two rules this file exists to honour:
 *
 * 1. **No colour literals.** Everything is read from `VizTokens`, which reads
 *    from `tokens.css`. A canvas has no cascade, so a hardcoded fill here
 *    would be invisible to the theme toggle forever.
 *
 * 2. **Past three nodes, colour cannot carry identity.** Measured with the
 *    palette validator: on an all-pairs layout, slot 4 puts yellow beside
 *    orange (normal-vision dE 10.6, floor is 15) and slot 5 puts magenta
 *    beside aqua (deutan dE 1.6). A ring places nodes by hash, so any two of
 *    them can end up adjacent. Every node therefore gets a direct label, and
 *    colour is a secondary cue.
 */

import { hash } from './hash'
import { midAngle, ownedArcs, pointOn, spreadAngles, widestArcPerNode } from './geometry'
import type { Point } from './geometry'
import { seriesColor } from '../../theme/vizTokens'
import type { VizTokens } from '../../theme/vizTokens'
import type { Assignment, KeyId, NodeId, VirtualNode } from './types'

export interface RingScene {
  readonly virtualNodes: readonly VirtualNode[]
  readonly nodeIds: readonly NodeId[]
  readonly keys: readonly KeyId[]
  readonly assignment: Assignment
  /** Dims every other node. Set on hover to isolate one node's arcs. */
  readonly focusedNodeId?: NodeId | undefined
}

const RING_INSET = 0.78
const KEY_RADIUS_RATIO = 0.86
const TICK_LENGTH = 9
const LABEL_GAP = 18
const LABEL_PADDING = 6

function colorFor(tokens: VizTokens, nodeIds: readonly NodeId[], nodeId: NodeId): string {
  return seriesColor(tokens, nodeIds.indexOf(nodeId))
}

/**
 * Resize the backing store to the element's CSS size times DPR, so strokes
 * land on whole device pixels instead of being resampled. Returns the CSS
 * dimensions, which is what every coordinate below is expressed in.
 */
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
  canvas.width = Math.round(rect.width * ratio)
  canvas.height = Math.round(rect.height * ratio)
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

  return { ctx, width: rect.width, height: rect.height }
}

export function drawRing(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  scene: RingScene,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height)

  const center: Point = { x: width / 2, y: height / 2 }
  const radius = (Math.min(width, height) / 2) * RING_INSET

  drawBaseRing(ctx, tokens, center, radius)

  if (scene.virtualNodes.length === 0) {
    drawEmptyRing(ctx, tokens, center)
    return
  }

  const arcs = ownedArcs(scene.virtualNodes)

  drawArcs(ctx, tokens, scene, arcs, center, radius)
  drawKeys(ctx, tokens, scene, center, radius)
  drawTicks(ctx, tokens, scene, center, radius)
  drawLabels(ctx, tokens, scene, arcs, center, radius)
}

function drawBaseRing(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  center: Point,
  radius: number,
): void {
  ctx.beginPath()
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
  ctx.strokeStyle = tokens.grid
  ctx.lineWidth = 1
  ctx.stroke()
}

function drawEmptyRing(ctx: CanvasRenderingContext2D, tokens: VizTokens, center: Point): void {
  ctx.fillStyle = tokens.ink
  ctx.font = '12px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('no nodes on the ring', center.x, center.y)
}

/**
 * The owned arcs, drawn as a thick band. This is the part that shows the
 * lesson: with one virtual node per node the bands are a few huge wedges, and
 * as V rises they shatter into interleaved slivers, which is exactly why load
 * evens out.
 */
function drawArcs(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  scene: RingScene,
  arcs: readonly ReturnType<typeof ownedArcs>[number][],
  center: Point,
  radius: number,
): void {
  ctx.lineWidth = 10

  arcs.forEach((arc) => {
    const dimmed = scene.focusedNodeId !== undefined && scene.focusedNodeId !== arc.nodeId

    ctx.globalAlpha = dimmed ? 0.15 : 1
    ctx.strokeStyle = colorFor(tokens, scene.nodeIds, arc.nodeId)
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius, arc.startAngle, arc.endAngle)
    ctx.stroke()
  })

  ctx.globalAlpha = 1
}

/**
 * One dot per key, at its hashed angle, just inside the band.
 *
 * Keys occupy no position on the ring itself, so this is a reading aid rather
 * than structure: it shows where a key lands and which arc catches it.
 */
function drawKeys(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  scene: RingScene,
  center: Point,
  radius: number,
): void {
  const keyRadius = radius * KEY_RADIUS_RATIO

  scene.keys.forEach((key) => {
    const owner = scene.assignment.get(key)
    if (owner === undefined) {
      return
    }

    const dimmed = scene.focusedNodeId !== undefined && scene.focusedNodeId !== owner
    const point = pointOn(center, keyRadius, angleOfKey(key))

    ctx.globalAlpha = dimmed ? 0.08 : 0.55
    ctx.fillStyle = colorFor(tokens, scene.nodeIds, owner)
    ctx.beginPath()
    ctx.arc(point.x, point.y, 1.6, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.globalAlpha = 1
}

function angleOfKey(key: KeyId): number {
  return (hash(key) / 2 ** 32) * Math.PI * 2 - Math.PI / 2
}

/** A tick per virtual node, so replica count is legible at a glance. */
function drawTicks(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  scene: RingScene,
  center: Point,
  radius: number,
): void {
  // Above a few hundred the ticks merge into a solid band and stop adding
  // information, while still costing a stroke each.
  if (scene.virtualNodes.length > 400) {
    return
  }

  ctx.lineWidth = 1

  scene.virtualNodes.forEach((virtualNode) => {
    const dimmed = scene.focusedNodeId !== undefined && scene.focusedNodeId !== virtualNode.nodeId
    const angle = (virtualNode.position / 2 ** 32) * Math.PI * 2 - Math.PI / 2
    const inner = pointOn(center, radius + 5, angle)
    const outer = pointOn(center, radius + 5 + TICK_LENGTH, angle)

    ctx.globalAlpha = dimmed ? 0.2 : 1
    ctx.strokeStyle = colorFor(tokens, scene.nodeIds, virtualNode.nodeId)
    ctx.beginPath()
    ctx.moveTo(inner.x, inner.y)
    ctx.lineTo(outer.x, outer.y)
    ctx.stroke()
  })

  ctx.globalAlpha = 1
}

/**
 * A direct label per node, on the widest arc that node owns.
 *
 * Not optional and not decoration: see the colour-vision limit at the top of
 * this file. The label is the identity; the colour agrees with it.
 */
function drawLabels(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  scene: RingScene,
  arcs: readonly ReturnType<typeof ownedArcs>[number][],
  center: Point,
  radius: number,
): void {
  const widest = widestArcPerNode(arcs)
  const entries = [...widest.entries()]

  if (entries.length === 0) {
    return
  }

  ctx.font = '600 11px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const labelRadius = radius + LABEL_GAP + TICK_LENGTH

  // Convert the widest label's pixel width into an angular one at the radius
  // the labels sit on, so the minimum gap is derived from what actually
  // overlaps rather than guessed.
  const widestLabelPx = Math.max(...entries.map(([nodeId]) => ctx.measureText(nodeId).width))
  const minGap = (widestLabelPx + LABEL_PADDING * 2) / labelRadius

  const angles = spreadAngles(
    entries.map(([, arc]) => midAngle(arc)),
    minGap,
  )

  entries.forEach(([nodeId], index) => {
    const angle = angles[index]
    if (angle === undefined) {
      return
    }

    const dimmed = scene.focusedNodeId !== undefined && scene.focusedNodeId !== nodeId
    const point = pointOn(center, labelRadius, angle)

    ctx.globalAlpha = dimmed ? 0.25 : 1

    // A plate behind the text, so a label crossing a tick stays readable.
    const textWidth = ctx.measureText(nodeId).width
    ctx.fillStyle = tokens.surface
    ctx.fillRect(point.x - textWidth / 2 - 3, point.y - 8, textWidth + 6, 16)

    ctx.fillStyle = colorFor(tokens, scene.nodeIds, nodeId)
    ctx.fillText(nodeId, point.x, point.y)
  })

  ctx.globalAlpha = 1
}
