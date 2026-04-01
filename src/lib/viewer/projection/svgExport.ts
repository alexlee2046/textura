// src/lib/viewer/projection/svgExport.ts
//
// SVG export for projection entities. Produces clean SVG markup with
// proper coordinate flipping (Y-down) and dash patterns for hidden lines.

import type {
  Entity,
  LineEntity,
  ArcEntity,
  SplineEntity,
  LayoutResult,
  Vec2,
  BBox2D,
} from './types'
import { computeBBox2D, isLayoutResult } from './types'
import { downloadBlob } from '@/lib/downloadBlob'

// ─── Constants ───

const VISIBLE_STYLE = 'stroke="black" stroke-width="0.7" fill="none"'

/** Collect all geometric points from entities (for bounding box computation). */
function collectPoints(entities: Entity[], offset: Vec2 = { x: 0, y: 0 }): Vec2[] {
  const points: Vec2[] = []
  for (const e of entities) {
    switch (e.type) {
      case 'line': {
        points.push(
          { x: e.from.x + offset.x, y: e.from.y + offset.y },
          { x: e.to.x + offset.x, y: e.to.y + offset.y },
        )
        break
      }
      case 'arc': {
        // Include center +/- radius as bounding estimate
        const cx = e.center.x + offset.x
        const cy = e.center.y + offset.y
        points.push(
          { x: cx - e.radius, y: cy - e.radius },
          { x: cx + e.radius, y: cy + e.radius },
        )
        break
      }
      case 'spline': {
        for (const p of e.controlPoints) {
          points.push({ x: p.x + offset.x, y: p.y + offset.y })
        }
        break
      }
    }
  }
  return points
}

/** Flip Y for SVG coordinate system (negate Y). */
function flipY(y: number): number {
  return -y
}

// ─── SVG element generators ───

function lineToSvg(e: LineEntity, offset: Vec2, style: string): string {
  const x1 = e.from.x + offset.x
  const y1 = flipY(e.from.y + offset.y)
  const x2 = e.to.x + offset.x
  const y2 = flipY(e.to.y + offset.y)
  return `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${style} />`
}

function arcToSvg(e: ArcEntity, offset: Vec2, style: string): string {
  const cx = e.center.x + offset.x
  const cy = e.center.y + offset.y
  const r = e.radius

  // Compute start and end points on the arc
  const startX = cx + r * Math.cos(e.startAngle)
  const startY = cy + r * Math.sin(e.startAngle)
  const endX = cx + r * Math.cos(e.endAngle)
  const endY = cy + r * Math.sin(e.endAngle)

  // Determine arc sweep
  let sweep = e.endAngle - e.startAngle
  if (sweep < 0) sweep += 2 * Math.PI

  const largeArcFlag = sweep > Math.PI ? 1 : 0
  // SVG Y is flipped, so sweep direction reverses
  const sweepFlag = 0

  const sx = startX
  const sy = flipY(startY)
  const ex = endX
  const ey = flipY(endY)

  return `  <path d="M ${sx},${sy} A ${r},${r} 0 ${largeArcFlag},${sweepFlag} ${ex},${ey}" ${style} />`
}

/**
 * Convert a spline entity to SVG cubic bezier path.
 *
 * For a degree-3 B-spline with the knot structure used in our curve fitter
 * (clamped uniform: [0,0,0,0, 1,1,1, ..., N,N,N,N]), control points map
 * directly to cubic Bezier segments:
 * - First segment: points 0,1,2,3
 * - Each subsequent segment: next 3 points
 */
function splineToSvg(e: SplineEntity, offset: Vec2, style: string): string {
  const pts = e.controlPoints
  if (pts.length < 2) return ''

  // For degree-3 splines with proper Bezier knot vectors,
  // each segment uses 4 control points (sharing the last with next first)
  if (e.degree === 3 && pts.length >= 4) {
    const ox = offset.x
    const oy = offset.y

    let d = `M ${pts[0].x + ox},${flipY(pts[0].y + oy)}`

    // First cubic bezier: points 0-3
    // Subsequent segments: every 3 points after that
    for (let i = 1; i + 2 <= pts.length - 1; i += 3) {
      const cp1 = pts[i]
      const cp2 = pts[i + 1]
      const end = pts[i + 2]
      d += ` C ${cp1.x + ox},${flipY(cp1.y + oy)} ${cp2.x + ox},${flipY(cp2.y + oy)} ${end.x + ox},${flipY(end.y + oy)}`
    }

    return `  <path d="${d}" ${style} />`
  }

  // Fallback for non-cubic or insufficient points: polyline through control points
  const ox = offset.x
  const oy = offset.y
  const pointsStr = pts.map(p => `${p.x + ox},${flipY(p.y + oy)}`).join(' ')
  return `  <polyline points="${pointsStr}" ${style} />`
}

function entityToSvg(entity: Entity, offset: Vec2, style: string): string {
  switch (entity.type) {
    case 'line':
      return lineToSvg(entity, offset, style)
    case 'arc':
      return arcToSvg(entity, offset, style)
    case 'spline':
      return splineToSvg(entity, offset, style)
  }
}

// ─── ViewBox computation ───

function computeViewBox(
  bbox: BBox2D,
  padding = 0.05,
): { minX: number; minY: number; width: number; height: number } {
  const padX = bbox.width * padding
  const padY = bbox.height * padding

  // Flip Y: original bbox min.y..max.y maps to -max.y..-min.y in SVG
  return {
    minX: bbox.min.x - padX,
    minY: -bbox.max.y - padY,
    width: bbox.width + 2 * padX,
    height: bbox.height + 2 * padY,
  }
}

// ─── Public API ───

/**
 * Generate SVG markup from an array of entities.
 */
export function generateSVG(
  entities: Entity[],
  options?: {
    strokeWidth?: number
    viewBox?: { minX: number; minY: number; width: number; height: number }
  },
): string {
  const points = collectPoints(entities)
  const bbox = points.length > 0
    ? computeBBox2D(points)
    : { min: { x: 0, y: 0 }, max: { x: 100, y: 100 }, width: 100, height: 100 }

  const vb = options?.viewBox ?? computeViewBox(bbox)
  const sw = options?.strokeWidth ?? 0.7
  const style = `stroke="black" stroke-width="${sw}" fill="none"`

  const noOffset: Vec2 = { x: 0, y: 0 }
  const elements = entities.map(e => entityToSvg(e, noOffset, style))

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.minX} ${vb.minY} ${vb.width} ${vb.height}">`,
    ...elements,
    '</svg>',
  ].join('\n')
}

/**
 * Generate SVG markup from a LayoutResult (multi-view drawing).
 * Applies per-view offsets so views are correctly positioned.
 */
export function generateLayoutSVG(
  layout: LayoutResult,
  options?: { showHidden?: boolean },
): string {
  const vb = computeViewBox(layout.totalBBox)

  const elements: string[] = []

  for (const view of layout.views) {
    const offset = layout.offsets[view.viewKey]
    for (const entity of view.entities) {
      elements.push(entityToSvg(entity, offset, VISIBLE_STYLE))
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.minX} ${vb.minY} ${vb.width} ${vb.height}">`,
    ...elements,
    '</svg>',
  ].join('\n')
}

/**
 * Browser download helper. Accepts either Entity[] or LayoutResult.
 * Generates SVG and triggers a file download via anchor click.
 */
export function exportSVG(
  data: Entity[] | LayoutResult,
  options?: { showHidden?: boolean; fileName?: string },
): void {
  const content = isLayoutResult(data)
    ? generateLayoutSVG(data, { showHidden: options?.showHidden })
    : generateSVG(data)

  const fileName = options?.fileName ?? 'export'
  downloadBlob(content, 'image/svg+xml', `${fileName}.svg`)
}
