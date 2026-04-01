// src/lib/viewer/projection/types.ts

// ─── Coordinate system ───
// three-edge-projection projects along Y-axis onto XZ plane.
// Vec2.x = Three.js X, Vec2.y = Three.js Z (Y is zeroed out).
// DXF export: Vec2.x → DXF X, Vec2.y → DXF Y.

export interface Vec2 { x: number; y: number }

export interface BBox2D {
  min: Vec2; max: Vec2
  width: number; height: number
}

// ─── Pipeline stages ───

export interface Segment { p1: Vec2; p2: Vec2 }

export interface Chain { points: Vec2[]; closed: boolean }

// ─── Curve-fitted entities ───

export interface LineEntity { type: 'line'; from: Vec2; to: Vec2 }

export interface ArcEntity {
  type: 'arc'
  center: Vec2; radius: number
  startAngle: number; endAngle: number
}

export interface SplineEntity {
  type: 'spline'
  controlPoints: Vec2[]
  knots: number[]
  degree: number
  closed: boolean
}

export type Entity = LineEntity | ArcEntity | SplineEntity

// ─── View results ───

export type ViewKey = 'front' | 'left' | 'top'

export interface ViewResult {
  viewKey: ViewKey
  entities: Entity[]
  rawSegments: Float32Array
  bbox: BBox2D
}

export interface LayoutResult {
  views: ViewResult[]
  offsets: Record<ViewKey, Vec2>
  totalBBox: BBox2D
  gap: number
}

// ─── Post-processing options ───

export interface PostProcessOptions {
  minSegmentRatio: number     // default 0.001
  mergeDistanceRatio: number  // default 5e-4
  minClusterSegments: number  // default 3
  minClusterLenRatio: number  // default 0.01
  cornerAngleDeg: number      // default 45
  fitTolerance: number         // default 0.002
}

export const DEFAULT_POST_PROCESS_OPTIONS: PostProcessOptions = {
  minSegmentRatio: 0.001,
  mergeDistanceRatio: 5e-4,
  minClusterSegments: 3,
  minClusterLenRatio: 0.01,
  cornerAngleDeg: 45,
  fitTolerance: 0.002,
}

export type DetailLevel = 'low' | 'medium' | 'high'

export const DETAIL_PRESETS: Record<DetailLevel, Partial<PostProcessOptions>> = {
  low:    { minSegmentRatio: 0.004, minClusterSegments: 5, minClusterLenRatio: 0.02 },
  medium: { minSegmentRatio: 0.001, minClusterSegments: 3, minClusterLenRatio: 0.01 },
  high:   { minSegmentRatio: 0.0005, minClusterSegments: 1, minClusterLenRatio: 0.001 },
}

// ─── Helpers ───

export function computeBBox2D(points: Vec2[]): BBox2D {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY }, width: maxX - minX, height: maxY - minY }
}

export function bboxDiagonal(bbox: BBox2D): number {
  return Math.sqrt(bbox.width * bbox.width + bbox.height * bbox.height)
}

/** Convert Float32Array of line segments (6 floats each: x1,y1,z1,x2,y2,z2)
 *  to 2D segments on XZ plane. */
export function float32ToSegments(arr: Float32Array): Segment[] {
  const segs: Segment[] = []
  for (let i = 0; i < arr.length; i += 6) {
    segs.push({ p1: { x: arr[i], y: arr[i + 2] }, p2: { x: arr[i + 3], y: arr[i + 5] } })
  }
  return segs
}

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function segmentLength(s: Segment): number {
  return dist(s.p1, s.p2)
}

export function isLayoutResult(data: Entity[] | LayoutResult): data is LayoutResult {
  return !Array.isArray(data) && 'views' in data && 'offsets' in data
}

/** Convert Segment[] back to Float32Array (y=0). */
export function segmentsToFloat32(segs: Segment[]): Float32Array {
  const arr = new Float32Array(segs.length * 6)
  for (let i = 0; i < segs.length; i++) {
    const off = i * 6
    arr[off] = segs[i].p1.x; arr[off + 1] = 0; arr[off + 2] = segs[i].p1.y
    arr[off + 3] = segs[i].p2.x; arr[off + 4] = 0; arr[off + 5] = segs[i].p2.y
  }
  return arr
}
