import { DxfWriter, Units, SplineFlags } from '@tarikjabiri/dxf'
import { downloadBlob } from '@/lib/downloadBlob'
import type { Line2D } from './edgeProjection'

// --- SVG path parsing (browser-side, same logic as route.ts) ---

type Point2D = [number, number]
type LineSegment = { type: 'line'; from: Point2D; to: Point2D }
type BezierSegment = {
  type: 'bezier'
  pts: [Point2D, Point2D, Point2D, Point2D]
}
type Segment = LineSegment | BezierSegment
interface SubPath {
  segments: Segment[]
  closed: boolean
}

/** Parse SVG <path> d-attributes into structured subpaths (browser-side version) */
function svgPathsToSubPaths(
  svgContent: string,
  canvasHeight: number,
): SubPath[] {
  const subPaths: SubPath[] = []
  const pathRegex = /\bd="([^"]+)"/g
  let pathMatch

  const flip = (x: number, y: number): Point2D => [x, canvasHeight - y]

  while ((pathMatch = pathRegex.exec(svgContent)) !== null) {
    const d = pathMatch[1]
    const tokens = d.match(
      /[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g,
    )
    if (!tokens) continue

    let segments: Segment[] = []
    let cursor: Point2D = [0, 0]
    let subpathStart: Point2D = [0, 0]

    for (const token of tokens) {
      const cmd = token[0]
      const nums = (
        token.slice(1).match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) || []
      ).map(Number)

      switch (cmd) {
        case 'M':
          if (segments.length > 0)
            subPaths.push({ segments, closed: false })
          cursor = flip(nums[0], nums[1])
          subpathStart = cursor
          segments = []
          break
        case 'm':
          if (segments.length > 0)
            subPaths.push({ segments, closed: false })
          cursor = [cursor[0] + nums[0], cursor[1] - nums[1]]
          subpathStart = cursor
          segments = []
          break
        case 'L':
          for (let i = 0; i < nums.length; i += 2) {
            const to = flip(nums[i], nums[i + 1])
            segments.push({ type: 'line', from: cursor, to })
            cursor = to
          }
          break
        case 'l':
          for (let i = 0; i < nums.length; i += 2) {
            const to: Point2D = [
              cursor[0] + nums[i],
              cursor[1] - nums[i + 1],
            ]
            segments.push({ type: 'line', from: cursor, to })
            cursor = to
          }
          break
        case 'C':
          for (let i = 0; i < nums.length; i += 6) {
            const p1 = flip(nums[i], nums[i + 1])
            const p2 = flip(nums[i + 2], nums[i + 3])
            const p3 = flip(nums[i + 4], nums[i + 5])
            segments.push({ type: 'bezier', pts: [cursor, p1, p2, p3] })
            cursor = p3
          }
          break
        case 'c':
          for (let i = 0; i < nums.length; i += 6) {
            const p1: Point2D = [
              cursor[0] + nums[i],
              cursor[1] - nums[i + 1],
            ]
            const p2: Point2D = [
              cursor[0] + nums[i + 2],
              cursor[1] - nums[i + 3],
            ]
            const p3: Point2D = [
              cursor[0] + nums[i + 4],
              cursor[1] - nums[i + 5],
            ]
            segments.push({ type: 'bezier', pts: [cursor, p1, p2, p3] })
            cursor = p3
          }
          break
        case 'Z':
        case 'z':
          if (
            cursor[0] !== subpathStart[0] ||
            cursor[1] !== subpathStart[1]
          ) {
            segments.push({ type: 'line', from: cursor, to: subpathStart })
          }
          cursor = subpathStart
          if (segments.length > 0)
            subPaths.push({ segments, closed: true })
          segments = []
          break
        default:
          console.warn(`SVG path: unsupported command "${cmd}", skipping`)
          break
      }
    }
    if (segments.length > 0) subPaths.push({ segments, closed: false })
  }
  return subPaths
}

/**
 * Merge geometric edge projections (LINE) and Potrace SVG outlines (SPLINE)
 * into a single DXF file with separate layers.
 *
 * - EDGES layer (color 7/white): geometric feature edges from edgeProjection
 * - OUTLINES layer (color 5/blue): Potrace-traced silhouette curves
 */
export function exportCompositeDXF(
  edgeLines: Line2D[],
  outlineSvg: string | null,
  fileName: string,
): void {
  const dxf = new DxfWriter()
  dxf.setUnits(Units.Millimeters)

  dxf.addLayer('EDGES', 7, 'CONTINUOUS')
  dxf.addLayer('OUTLINES', 5, 'CONTINUOUS')

  // Parse SVG dimensions first (needed for NDC → SVG coordinate mapping)
  let svgW = 0
  let svgH = 0
  if (outlineSvg) {
    const dimMatch = outlineSvg.match(
      /width="([\d.]+)(?:pt)?"\s+height="([\d.]+)(?:pt)?"/,
    )
    svgW = dimMatch ? parseFloat(dimMatch[1]) : 100
    svgH = dimMatch ? parseFloat(dimMatch[2]) : 100
  }

  // Part 1: Edge lines (geometric projection)
  // edgeProjection outputs NDC [-1,1]. When outlineSvg exists we must
  // map NDC into the same SVG pixel/pt space so both layers align.
  for (const line of edgeLines) {
    let x0 = line.from[0], y0 = line.from[1]
    let x1 = line.to[0],   y1 = line.to[1]
    if (outlineSvg) {
      x0 = (x0 + 1) / 2 * svgW
      y0 = (y0 + 1) / 2 * svgH
      x1 = (x1 + 1) / 2 * svgW
      y1 = (y1 + 1) / 2 * svgH
    }
    dxf.addLine(
      { x: x0, y: y0, z: 0 },
      { x: x1, y: y1, z: 0 },
      { layerName: 'EDGES' },
    )
  }

  // Part 2: Outline splines (from Potrace SVG, if available)
  if (outlineSvg) {

    const subPaths = svgPathsToSubPaths(outlineSvg, svgH)

    for (const subPath of subPaths) {
      let bezierRun: BezierSegment[] = []

      const flushBezierRun = () => {
        if (bezierRun.length === 0) return
        const N = bezierRun.length
        const ctrlPts = [
          {
            x: bezierRun[0].pts[0][0],
            y: bezierRun[0].pts[0][1],
            z: 0,
          },
        ]
        for (const seg of bezierRun) {
          ctrlPts.push(
            { x: seg.pts[1][0], y: seg.pts[1][1], z: 0 },
            { x: seg.pts[2][0], y: seg.pts[2][1], z: 0 },
            { x: seg.pts[3][0], y: seg.pts[3][1], z: 0 },
          )
        }
        const knots: number[] = [0, 0, 0, 0]
        for (let i = 1; i < N; i++) knots.push(i, i, i)
        knots.push(N, N, N, N)

        // Never set SplineFlags.Closed — Potrace's Z command already
        // closes the path via a LINE segment, and Closed + clamped
        // knot vector causes seam breaks in AutoCAD.
        dxf.addSpline(
          {
            controlPoints: ctrlPts,
            degreeCurve: 3,
            flags: SplineFlags.Planar,
            knots,
          },
          { layerName: 'OUTLINES' },
        )
        bezierRun = []
      }

      for (const seg of subPath.segments) {
        if (seg.type === 'bezier') {
          bezierRun.push(seg)
        } else {
          flushBezierRun()
          dxf.addLine(
            { x: seg.from[0], y: seg.from[1], z: 0 },
            { x: seg.to[0], y: seg.to[1], z: 0 },
            { layerName: 'OUTLINES' },
          )
        }
      }
      flushBezierRun()
    }
  }

  const content = dxf.stringify()
  downloadBlob(content, 'application/dxf', `${fileName}.dxf`)
}
