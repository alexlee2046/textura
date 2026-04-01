// src/lib/viewer/projection/curveFit.ts
// Chain → Entity curve fitting: LINE, ARC, SPLINE
// Pure math — no DOM/Three.js dependencies, safe for Web Workers.

import fitCurve from 'fit-curve'
import type {
  Vec2, Chain, Entity, LineEntity, ArcEntity, SplineEntity,
} from './types'
import { DEFAULT_POST_PROCESS_OPTIONS, dist } from './types'

// ─── Geometry helpers ─────────────────────────────────────────

/** Perpendicular distance from point P to line AB. */
function pointToLineDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return dist(p, a)
  const cross = Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx)
  return cross / Math.sqrt(lenSq)
}

// ─── 1. Smooth ────────────────────────────────────────────────

/** Sliding-window mean smoothing. Preserves endpoints. */
export function smoothPoints(points: Vec2[], windowSize = 3): Vec2[] {
  if (points.length <= 2 || windowSize < 2) return points.slice()
  const half = Math.floor(windowSize / 2)
  const out: Vec2[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    let sx = 0, sy = 0, n = 0
    for (let j = Math.max(0, i - half); j <= Math.min(points.length - 1, i + half); j++) {
      sx += points[j].x
      sy += points[j].y
      n++
    }
    out.push({ x: sx / n, y: sy / n })
  }
  out.push(points[points.length - 1])
  return out
}

// ─── 2. Corner detection ──────────────────────────────────────

/** Detect corners by deflection angle. Returns corner indices. */
export function detectCorners(points: Vec2[], angleDeg: number): number[] {
  if (points.length < 3) return []
  const threshold = angleDeg * (Math.PI / 180)
  const corners: number[] = []

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]

    // Vectors: incoming and outgoing
    const ax = curr.x - prev.x
    const ay = curr.y - prev.y
    const bx = next.x - curr.x
    const by = next.y - curr.y

    const magA = Math.sqrt(ax * ax + ay * ay)
    const magB = Math.sqrt(bx * bx + by * by)
    if (magA < 1e-12 || magB < 1e-12) continue

    // Deflection angle = PI - angle between vectors
    const dot = ax * bx + ay * by
    const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magB)))
    const angle = Math.acos(cosAngle) // 0 = same direction, PI = reversal

    // angle is already the deflection (0 = straight, PI = U-turn)
    if (angle > threshold) {
      corners.push(i)
    }
  }
  return corners
}

// ─── 3. Split at corners ──────────────────────────────────────

/** Split a chain at corner indices. Corner point appears in both adjacent sub-chains. */
export function splitAtCorners(points: Vec2[], cornerIndices: number[]): Vec2[][] {
  if (cornerIndices.length === 0) return [points]

  const subChains: Vec2[][] = []
  let start = 0
  for (const ci of cornerIndices) {
    subChains.push(points.slice(start, ci + 1))
    start = ci
  }
  subChains.push(points.slice(start))

  // Filter out degenerate sub-chains (< 2 points)
  return subChains.filter(sc => sc.length >= 2)
}

// ─── 4a. Line test ────────────────────────────────────────────

function isLine(points: Vec2[], D: number): boolean {
  const first = points[0]
  const last = points[points.length - 1]
  const threshold = 0.001 * D
  for (let i = 1; i < points.length - 1; i++) {
    if (pointToLineDist(points[i], first, last) > threshold) return false
  }
  return true
}

function makeLine(points: Vec2[]): LineEntity {
  return { type: 'line', from: { ...points[0] }, to: { ...points[points.length - 1] } }
}

// ─── 4b. Arc fit (Kåsa circle fit) ───────────────────────────

interface CircleFitResult {
  cx: number; cy: number; r: number; residual: number
}

/** Kåsa least-squares algebraic circle fit. */
function kasaCircleFit(points: Vec2[]): CircleFitResult | null {
  const n = points.length
  if (n < 3) return null

  let sx = 0, sy = 0
  for (const p of points) { sx += p.x; sy += p.y }
  const mx = sx / n, my = sy / n

  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0
  for (const p of points) {
    const u = p.x - mx
    const v = p.y - my
    suu += u * u
    svv += v * v
    suv += u * v
    suuu += u * u * u
    svvv += v * v * v
    suvv += u * v * v
    svuu += v * u * u
  }

  const det = suu * svv - suv * suv
  if (Math.abs(det) < 1e-12) return null

  const rhs1 = 0.5 * (suuu + suvv)
  const rhs2 = 0.5 * (svvv + svuu)

  const uc = (svv * rhs1 - suv * rhs2) / det
  const vc = (suu * rhs2 - suv * rhs1) / det

  const cx = uc + mx
  const cy = vc + my
  const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n)

  // Compute residual (mean absolute radius deviation)
  let sumDev = 0
  for (const p of points) {
    const d = Math.abs(dist(p, { x: cx, y: cy }) - r)
    sumDev += d
  }
  const residual = sumDev / n

  return { cx, cy, r, residual }
}

function fitArc(points: Vec2[], D: number): ArcEntity | null {
  const fit = kasaCircleFit(points)
  if (!fit) return null

  const { cx, cy, r, residual } = fit

  // Validation thresholds
  if (residual > 0.002 * D) return null
  if (r > 10 * D) return null

  // Reject arcs where radius is much larger than chord length (near-straight lines)
  const chord = dist(points[0], points[points.length - 1])
  if (chord < 1e-10) return null
  if (r / chord > 5) return null  // ratio > 5 means curvature is negligible

  // Compute start and end angles
  const first = points[0]
  const last = points[points.length - 1]
  const startAngle = Math.atan2(first.y - cy, first.x - cx)
  const endAngle = Math.atan2(last.y - cy, last.x - cx)

  // Check subtended angle (< 350°)
  let sweep = endAngle - startAngle
  // Determine sweep direction from the point sequence
  // Use the midpoint to check which direction the arc goes
  const midIdx = Math.floor(points.length / 2)
  const midAngle = Math.atan2(points[midIdx].y - cy, points[midIdx].x - cx)

  // Normalize sweep based on whether midpoint is between start and end
  // going counterclockwise or clockwise
  const ccw = normalizedAngleBetween(startAngle, midAngle, endAngle)
  if (ccw) {
    sweep = endAngle - startAngle
    if (sweep <= 0) sweep += 2 * Math.PI
  } else {
    sweep = endAngle - startAngle
    if (sweep >= 0) sweep -= 2 * Math.PI
  }

  if (Math.abs(sweep) > (350 / 180) * Math.PI) return null

  // Verify curvature sign is monotone (all points on same side)
  const cross0 = crossSign(points[0], points[1], { x: cx, y: cy })
  for (let i = 1; i < points.length - 1; i++) {
    const cs = crossSign(points[i], points[i + 1], { x: cx, y: cy })
    if (cs !== 0 && cross0 !== 0 && cs !== cross0) return null
  }

  return {
    type: 'arc',
    center: { x: cx, y: cy },
    radius: r,
    startAngle,
    endAngle,
  }
}

/** Check if midAngle is between startAngle and endAngle going counterclockwise. */
function normalizedAngleBetween(start: number, mid: number, end: number): boolean {
  // Normalize all to [0, 2PI)
  const normalize = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  const s = normalize(start)
  const m = normalize(mid)
  const e = normalize(end)

  // CCW from s to e
  const sweepCCW = e >= s ? e - s : e - s + 2 * Math.PI
  const midCCW = m >= s ? m - s : m - s + 2 * Math.PI

  return midCCW <= sweepCCW
}

function crossSign(a: Vec2, b: Vec2, center: Vec2): number {
  const ax = a.x - center.x
  const ay = a.y - center.y
  const bx = b.x - center.x
  const by = b.y - center.y
  const cross = ax * by - ay * bx
  if (Math.abs(cross) < 1e-12) return 0
  return cross > 0 ? 1 : -1
}

// ─── 4c. Spline fit (Schneider via fit-curve) ─────────────────

function fitSpline(points: Vec2[], D: number, tolerance: number): SplineEntity {
  const pts = points.map(p => [p.x, p.y])
  const error = tolerance * D

  const beziers: number[][][] = fitCurve(pts, error)

  if (beziers.length === 0) {
    // Fallback: single line as spline
    return {
      type: 'spline',
      controlPoints: points.map(p => ({ x: p.x, y: p.y })),
      knots: [0, 0, 0, 0, 1, 1, 1, 1],
      degree: 3,
      closed: false,
    }
  }

  // Build control points: first bezier's 4 points, then for each subsequent only 3 (skip start)
  const ctrlPts: Vec2[] = [
    { x: beziers[0][0][0], y: beziers[0][0][1] },
    { x: beziers[0][1][0], y: beziers[0][1][1] },
    { x: beziers[0][2][0], y: beziers[0][2][1] },
    { x: beziers[0][3][0], y: beziers[0][3][1] },
  ]
  for (let i = 1; i < beziers.length; i++) {
    ctrlPts.push(
      { x: beziers[i][1][0], y: beziers[i][1][1] },
      { x: beziers[i][2][0], y: beziers[i][2][1] },
      { x: beziers[i][3][0], y: beziers[i][3][1] },
    )
  }

  // Knot vector for N bezier segments: [0,0,0,0, 1,1,1, 2,2,2, ..., N,N,N,N]
  const N = beziers.length
  const knots = [0, 0, 0, 0]
  for (let i = 1; i < N; i++) knots.push(i, i, i)
  knots.push(N, N, N, N)

  return {
    type: 'spline',
    controlPoints: ctrlPts,
    knots,
    degree: 3,
    closed: false,
  }
}

// ─── 4. Fit sub-chain ─────────────────────────────────────────

function fitSubChain(points: Vec2[], D: number, tolerance: number): Entity {
  // 2 points → always a line
  if (points.length <= 2) return makeLine(points)

  // Collinear test
  if (isLine(points, D)) return makeLine(points)

  // Try arc fit
  const arc = fitArc(points, D)
  if (arc) return arc

  // Fallback to spline
  return fitSpline(points, D, tolerance)
}

// ─── 5. Main orchestrator ─────────────────────────────────────

export interface FitOptions {
  cornerAngleDeg?: number
  fitTolerance?: number
  smoothWindow?: number
}

/**
 * Fit chains to geometric entities (LINE, ARC, SPLINE).
 *
 * @param chains - Input chains from lineGraph
 * @param D - Bounding-box diagonal (used for relative thresholds)
 * @param opts - Override default corner angle and tolerance
 * @returns Array of fitted entities
 */
export function fitChains(
  chains: Chain[],
  D: number,
  opts?: FitOptions,
): Entity[] {
  if (chains.length === 0) return []

  const cornerAngleDeg = opts?.cornerAngleDeg ?? DEFAULT_POST_PROCESS_OPTIONS.cornerAngleDeg
  const fitTolerance = opts?.fitTolerance ?? DEFAULT_POST_PROCESS_OPTIONS.fitTolerance
  const smoothWindow = opts?.smoothWindow ?? 3

  const entities: Entity[] = []

  for (const chain of chains) {
    if (chain.points.length < 2) continue

    // Step 1: Detect corners on original points (before smoothing)
    const corners = detectCorners(chain.points, cornerAngleDeg)

    // Step 2: Split at corners
    const subChains = splitAtCorners(chain.points, corners)

    // Step 3: Smooth each sub-chain individually, then fit
    for (const sc of subChains) {
      const smoothed = smoothPoints(sc, smoothWindow)
      entities.push(fitSubChain(smoothed, D, fitTolerance))
    }
  }

  return entities
}
