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
import { easeOut, hasReached, replicaName } from './trace'
import type { PhaseState, RoutingTrace } from './trace'
import { seriesColor } from '../../theme/vizTokens'
import type { VizTokens } from '../../theme/vizTokens'
import type { Assignment, KeyId, NodeId, VirtualNode } from './types'

/** One request in flight, at a point in time. */
export interface Flight {
  readonly trace: RoutingTrace
  readonly phase: PhaseState
}

export interface RingScene {
  readonly virtualNodes: readonly VirtualNode[]
  readonly nodeIds: readonly NodeId[]
  readonly keys: readonly KeyId[]
  readonly assignment: Assignment
  /** Dims every other node, isolating this one's arcs. */
  readonly focusedNodeId?: NodeId | undefined
  /**
   * How hard to push the other nodes back.
   *
   * Hovering a row of the load table is a deliberate question, so it gets the
   * strong treatment. The highlight at the end of each flight is automatic and
   * fires every couple of seconds, so it gets a nudge: at 0.15 alpha on a
   * light background the other three nodes did not recede, they disappeared,
   * and the ring read as broken rather than as focused.
   */
  readonly focusStrength?: 'strong' | 'soft'
  /** The request currently being routed, if any. */
  readonly flight?: Flight | undefined
  /** Requests already routed, which stay marked so the past is visible. */
  readonly routed?: readonly RoutingTrace[] | undefined
}

const RING_INSET = 0.78
const KEY_RADIUS_RATIO = 0.86
const TICK_LENGTH = 9
const LABEL_GAP = 18
const LABEL_PADDING = 6

/**
 * The background key cloud drops to this alpha while a request is in flight.
 *
 * Six hundred dots at 0.55 and one dot at 1.0 is not a contrast the eye wins:
 * the flyer is the same size as the noise it sits in. Pushing the cloud down
 * rather than the flyer up keeps the flyer's colour honest, since it stays the
 * accent rather than becoming a brighter series hue.
 */
const CLOUD_ALPHA_IN_FLIGHT = 0.12
const CLOUD_ALPHA = 0.55

const FLIGHT_DOT_RADIUS = 5
const TRAIL_WIDTH = 4
/** Surface-coloured gap each side of the trail, so it never merges with a band. */
const TRAIL_HALO = 2
const ROUTED_DOT_RADIUS = 3
const KEY_DOT_RADIUS = 1.6
const LANDING_LEADER_START = 8
const LANDING_LEADER_END = 22
const LANDING_LABEL_INSET = 34

function colorFor(tokens: VizTokens, nodeIds: readonly NodeId[], nodeId: NodeId): string {
  return seriesColor(tokens, nodeIds.indexOf(nodeId))
}

type Mark = 'arc' | 'key' | 'tick' | 'label' | 'routed'

const DIM: Record<'strong' | 'soft', Record<Mark, number>> = {
  strong: { arc: 0.15, key: 0.08, tick: 0.2, label: 0.25, routed: 0.2 },
  soft: { arc: 0.45, key: 0.09, tick: 0.5, label: 0.6, routed: 0.45 },
}

/**
 * Alpha for a mark belonging to `nodeId`, given whatever is focused.
 *
 * One function rather than a ternary at each call site, because the dim levels
 * have to move together: arcs, ticks and labels dimming by different amounts
 * is what makes a focused ring look like a rendering bug instead of a choice.
 */
function alphaFor(scene: RingScene, nodeId: NodeId, mark: Mark, full: number): number {
  if (scene.focusedNodeId === undefined || scene.focusedNodeId === nodeId) {
    return full
  }
  return DIM[scene.focusStrength ?? 'strong'][mark]
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
  const width = Math.round(rect.width * ratio)
  const height = Math.round(rect.height * ratio)

  // Assigning canvas.width reallocates the backing store and clears it, even
  // when the value is unchanged. That is fine once per resize and wasteful
  // sixty times a second during playback, so only touch it when it moved.
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

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
  drawRouted(ctx, tokens, scene, center, radius)

  if (scene.flight) {
    drawFlight(ctx, tokens, scene, scene.flight, center, radius)
  }

  // Labels last: they are the identity channel past three nodes, so nothing
  // the flight draws is allowed to cover them.
  drawLabels(ctx, tokens, scene, arcs, center, radius)

  if (scene.flight) {
    drawReadout(ctx, tokens, scene.flight, center)
  }
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
    ctx.globalAlpha = alphaFor(scene, arc.nodeId, 'arc', 1)
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
  const base = scene.flight ? CLOUD_ALPHA_IN_FLIGHT : CLOUD_ALPHA

  // One path per node rather than one fill per key.
  //
  // This is the only hot loop on the figure: it runs every animation frame and
  // the key count is the largest number the visitor can turn up. A fill per
  // key made 2000 keys cost 2000 draw calls a frame; grouping by owner makes
  // it one per node, which is four.
  const byOwner = new Map<NodeId, Path2D>()

  scene.keys.forEach((key) => {
    const owner = scene.assignment.get(key)
    if (owner === undefined) {
      return
    }

    let path = byOwner.get(owner)
    if (!path) {
      path = new Path2D()
      byOwner.set(owner, path)
    }

    const point = pointOn(center, keyRadius, angleOfKey(key))
    // moveTo before each arc, or the canvas joins consecutive arcs with a line.
    path.moveTo(point.x + KEY_DOT_RADIUS, point.y)
    path.arc(point.x, point.y, KEY_DOT_RADIUS, 0, Math.PI * 2)
  })

  byOwner.forEach((path, owner) => {
    ctx.globalAlpha = alphaFor(scene, owner, 'key', base)
    ctx.fillStyle = colorFor(tokens, scene.nodeIds, owner)
    ctx.fill(path)
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
    const angle = (virtualNode.position / 2 ** 32) * Math.PI * 2 - Math.PI / 2
    const inner = pointOn(center, radius + 5, angle)
    const outer = pointOn(center, radius + 5 + TICK_LENGTH, angle)

    ctx.globalAlpha = alphaFor(scene, virtualNode.nodeId, 'tick', 1)
    ctx.strokeStyle = colorFor(tokens, scene.nodeIds, virtualNode.nodeId)
    ctx.beginPath()
    ctx.moveTo(inner.x, inner.y)
    ctx.lineTo(outer.x, outer.y)
    ctx.stroke()
  })

  ctx.globalAlpha = 1
}

/**
 * Requests already routed, left on the rim so the past is visible.
 *
 * Drawn in the owning node's colour rather than the accent: once a request has
 * resolved it is no longer live, it is a fact about the distribution, and the
 * accent is reserved for the one thing currently happening.
 */
function drawRouted(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  scene: RingScene,
  center: Point,
  radius: number,
): void {
  const routed = scene.routed
  if (!routed || routed.length === 0) {
    return
  }

  routed.forEach((trace) => {
    const point = pointOn(center, radius, trace.keyAngle)

    ctx.globalAlpha = alphaFor(scene, trace.owner, 'routed', 1)

    // A surface ring so a routed dot sitting on the coloured band stays a
    // separate mark instead of merging into it.
    ctx.beginPath()
    ctx.arc(point.x, point.y, ROUTED_DOT_RADIUS + 1.5, 0, Math.PI * 2)
    ctx.fillStyle = tokens.surface
    ctx.fill()

    ctx.beginPath()
    ctx.arc(point.x, point.y, ROUTED_DOT_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = colorFor(tokens, scene.nodeIds, trace.owner)
    ctx.fill()
  })

  ctx.globalAlpha = 1
}

/**
 * The request in flight.
 *
 * Everything here is drawn in the accent, which `CLAUDE.md` reserves for chrome
 * and explicitly permits for "the live marker". That is not a loophole, it is
 * the point: the flyer must never be mistakable for a series colour, because a
 * key in flight does not belong to any node yet. It acquires an identity only
 * at the moment it lands, which is exactly when the mark switches to the
 * owner's colour.
 */
function drawFlight(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  scene: RingScene,
  flight: Flight,
  center: Point,
  radius: number,
): void {
  const { trace, phase } = flight

  if (hasReached(phase, 'hash')) {
    drawHashMarker(ctx, tokens, trace, phase, center, radius)
  }

  if (hasReached(phase, 'walk')) {
    drawTrail(ctx, tokens, trace, phase, center, radius)
  }

  if (hasReached(phase, 'resolve')) {
    drawLanding(ctx, tokens, scene, trace, phase, center, radius)
  }

  if (hasReached(phase, 'drop')) {
    drawFlyingKey(ctx, tokens, trace, phase, center, radius)
  }
}

/**
 * A radial tick at the key's hashed position.
 *
 * This mark is the whole first half of the idea: the position is a property of
 * the key alone. It is computed before the walk starts and it does not move
 * when nodes come and go, which is why it is drawn before anything about
 * ownership appears.
 */
function drawHashMarker(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  trace: RoutingTrace,
  phase: PhaseState,
  center: Point,
  radius: number,
): void {
  const grow = phase.phase === 'hash' ? easeOut(phase.local) : 1
  const inner = pointOn(center, radius - 14 * grow, trace.keyAngle)
  const outer = pointOn(center, radius + 14 * grow, trace.keyAngle)

  ctx.strokeStyle = tokens.accent
  ctx.lineWidth = 1.5
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  ctx.moveTo(inner.x, inner.y)
  ctx.lineTo(outer.x, outer.y)
  ctx.stroke()
  ctx.globalAlpha = 1
}

/**
 * The clockwise walk, drawn as it is travelled.
 *
 * Stroked twice: a wider pass in the surface colour, then the accent on top.
 * The first pass is not decoration, it is what stops the trail from being read
 * as a node.
 *
 * This site's accent and its second series slot are both orange (#e8853f and
 * #eb6834 in dark), so a 4px accent arc sitting inside a 10px orange band read
 * as a thin stripe of n2 rather than as something passing over it. Separating
 * them by hue is not available -- the accent is fixed and the series order is
 * fixed -- so they are separated by a gap instead, which works regardless of
 * which node the key happens to be flying across.
 */
function drawTrail(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  trace: RoutingTrace,
  phase: PhaseState,
  center: Point,
  radius: number,
): void {
  const travelled = phase.phase === 'walk' ? easeOut(phase.local) : 1
  const end = trace.keyAngle + trace.sweep * travelled

  if (trace.sweep * travelled < 1e-4) {
    return
  }

  ctx.lineCap = 'round'

  ctx.strokeStyle = tokens.surface
  ctx.lineWidth = TRAIL_WIDTH + TRAIL_HALO * 2
  ctx.beginPath()
  ctx.arc(center.x, center.y, radius, trace.keyAngle, end)
  ctx.stroke()

  ctx.strokeStyle = tokens.accent
  ctx.lineWidth = TRAIL_WIDTH
  ctx.beginPath()
  ctx.arc(center.x, center.y, radius, trace.keyAngle, end)
  ctx.stroke()

  ctx.lineCap = 'butt'
}

/** The replica the walk landed on, popping once as it takes ownership. */
function drawLanding(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  scene: RingScene,
  trace: RoutingTrace,
  phase: PhaseState,
  center: Point,
  radius: number,
): void {
  // Overshoot then settle. A mark that arrives at its final size reads as
  // having always been there; one that pops reads as having just happened.
  const settle = easeOut(Math.min(1, phase.local * 2.5))
  const scale = 1 + 0.9 * (1 - settle)
  const point = pointOn(center, radius, trace.landingAngle)

  ctx.beginPath()
  ctx.arc(point.x, point.y, (FLIGHT_DOT_RADIUS + 2.5) * scale, 0, Math.PI * 2)
  ctx.fillStyle = tokens.surface
  ctx.fill()

  ctx.beginPath()
  ctx.arc(point.x, point.y, FLIGHT_DOT_RADIUS * scale, 0, Math.PI * 2)
  ctx.fillStyle = colorFor(tokens, scene.nodeIds, trace.owner)
  ctx.fill()

  drawLandingLabel(ctx, tokens, scene, trace, phase, center, radius)
}

/**
 * The replica's name, on a leader pointing inward from where it sits.
 *
 * Needed because the walk is short. At the default of 8 virtual nodes the
 * median walk is 23 pixels, so the arrival is a small movement in a ring full
 * of small marks; without a name attached, "it landed there" is a claim the
 * visitor has to take on trust. Inward rather than outward because the node
 * labels already occupy the outside and this would sit on top of them.
 */
function drawLandingLabel(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  scene: RingScene,
  trace: RoutingTrace,
  phase: PhaseState,
  center: Point,
  radius: number,
): void {
  const appear = easeOut(Math.min(1, phase.local * 2))
  if (appear <= 0.01) {
    return
  }

  const from = pointOn(center, radius - LANDING_LEADER_START, trace.landingAngle)
  const to = pointOn(center, radius - LANDING_LEADER_END * appear, trace.landingAngle)
  const anchor = pointOn(center, radius - LANDING_LABEL_INSET * appear, trace.landingAngle)
  const color = colorFor(tokens, scene.nodeIds, trace.owner)
  const text = replicaName(trace.landing)

  ctx.globalAlpha = appear
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()

  ctx.font = '600 11px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const width = ctx.measureText(text).width
  ctx.fillStyle = tokens.surface
  ctx.fillRect(anchor.x - width / 2 - 4, anchor.y - 8, width + 8, 16)

  ctx.fillStyle = color
  ctx.fillText(text, anchor.x, anchor.y)
  ctx.globalAlpha = 1
}

/**
 * The key itself: out from the centre to its position, then clockwise.
 *
 * Starting at the centre rather than at the rim is deliberate. A request
 * arrives at the *system*, not at a position on the ring; it has no position
 * until it is hashed. Flying it outward from the middle makes hashing look
 * like what it is, a step that assigns a location, rather than something the
 * key turned up already knowing.
 */
function drawFlyingKey(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  trace: RoutingTrace,
  phase: PhaseState,
  center: Point,
  radius: number,
): void {
  let angle = trace.keyAngle
  let distance = radius

  if (phase.phase === 'drop') {
    distance = radius * easeOut(phase.local)
  } else if (phase.phase === 'walk') {
    angle = trace.keyAngle + trace.sweep * easeOut(phase.local)
  } else if (phase.phase === 'resolve') {
    angle = trace.landingAngle
  }

  // Once landed, the coloured landing mark is the thing to look at; keeping a
  // full-strength accent dot on top of it would argue with the answer.
  const alpha = phase.phase === 'resolve' ? 1 - easeOut(phase.local) : 1
  if (alpha <= 0.01) {
    return
  }

  const point = pointOn(center, distance, angle)

  ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.arc(point.x, point.y, FLIGHT_DOT_RADIUS + 2, 0, Math.PI * 2)
  ctx.fillStyle = tokens.surface
  ctx.fill()

  ctx.beginPath()
  ctx.arc(point.x, point.y, FLIGHT_DOT_RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = tokens.accent
  ctx.fill()
  ctx.globalAlpha = 1
}

/**
 * Two lines in the middle of the ring: the key, and where it hashed to.
 *
 * The centre is the only large empty area on this figure and it is where the
 * flight starts, so the request's own identity belongs there rather than off
 * to one side where it would compete with the load table.
 *
 * It deliberately stops at the hash. The answer is stated once, on the ring,
 * attached to the place it happened; repeating it here as well put the same
 * replica name on screen three times over, counting the trace panel, which
 * reads as three findings rather than one.
 */
function drawReadout(
  ctx: CanvasRenderingContext2D,
  tokens: VizTokens,
  flight: Flight,
  center: Point,
): void {
  const { trace, phase } = flight

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.globalAlpha = phase.phase === 'arrive' ? easeOut(phase.local) : 1
  ctx.font = '600 14px ui-monospace, monospace'
  ctx.fillStyle = tokens.inkStrong
  ctx.fillText(trace.key, center.x, center.y - 9)
  ctx.globalAlpha = 1

  if (hasReached(phase, 'hash')) {
    ctx.globalAlpha = phase.phase === 'hash' ? easeOut(phase.local) : 1
    ctx.font = '11px ui-monospace, monospace'
    ctx.fillStyle = tokens.ink
    ctx.fillText(formatPosition(trace.position), center.x, center.y + 11)
    ctx.globalAlpha = 1
  }
}

/** Hex, because a ring position is an address rather than a quantity. */
export function formatPosition(position: number): string {
  return `0x${position.toString(16).padStart(8, '0')}`
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

    const point = pointOn(center, labelRadius, angle)

    ctx.globalAlpha = alphaFor(scene, nodeId, 'label', 1)

    // A plate behind the text, so a label crossing a tick stays readable.
    const textWidth = ctx.measureText(nodeId).width
    ctx.fillStyle = tokens.surface
    ctx.fillRect(point.x - textWidth / 2 - 3, point.y - 8, textWidth + 6, 16)

    ctx.fillStyle = colorFor(tokens, scene.nodeIds, nodeId)
    ctx.fillText(nodeId, point.x, point.y)
  })

  ctx.globalAlpha = 1
}
