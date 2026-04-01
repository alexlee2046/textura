// src/lib/viewer/projection/enhancedDxfExport.ts
//
// Enhanced DXF export with native SPLINE entities (lossless curves).
// Uses @tarikjabiri/dxf to generate fully-structured DXF files
// compatible with AutoCAD 2015+.

import { DxfWriter, Units, SplineFlags } from '@tarikjabiri/dxf'
import type {
  Entity,
  LayoutResult,
  Vec2,
} from './types'
import { isLayoutResult } from './types'
import { downloadBlob } from '@/lib/downloadBlob'

// ─── Helpers ───

const RAD2DEG = 180 / Math.PI

function offsetPoint(p: Vec2, offset: Vec2): Vec2 {
  return { x: p.x + offset.x, y: p.y + offset.y }
}

// ─── DXF writer core ───

function setupDxf(): DxfWriter {
  const dxf = new DxfWriter()
  dxf.setUnits(Units.Millimeters)

  // Register DASHED linetype before referencing it in the layer
  dxf.addLType('DASHED', 'Dashed line __', [0.5, -0.25])

  dxf.addLayer('VISIBLE', 7, 'CONTINUOUS')
  dxf.addLayer('HIDDEN', 8, 'DASHED')

  return dxf
}

function writeEntity(
  dxf: DxfWriter,
  entity: Entity,
  layerName: string,
  offset: Vec2 = { x: 0, y: 0 },
): void {
  switch (entity.type) {
    case 'line': {
      const from = offsetPoint(entity.from, offset)
      const to = offsetPoint(entity.to, offset)
      dxf.addLine(
        { x: from.x, y: from.y, z: 0 },
        { x: to.x, y: to.y, z: 0 },
        { layerName },
      )
      break
    }
    case 'arc': {
      const center = offsetPoint(entity.center, offset)
      // ArcEntity stores angles in radians; DXF addArc expects degrees
      dxf.addArc(
        { x: center.x, y: center.y, z: 0 },
        entity.radius,
        entity.startAngle * RAD2DEG,
        entity.endAngle * RAD2DEG,
        { layerName },
      )
      break
    }
    case 'spline': {
      const controlPoints = entity.controlPoints.map(p => {
        const op = offsetPoint(p, offset)
        return { x: op.x, y: op.y, z: 0 }
      })

      const flags =
        SplineFlags.Planar | (entity.closed ? SplineFlags.Closed : 0)

      dxf.addSpline(
        {
          controlPoints,
          degreeCurve: entity.degree,
          flags,
          knots: entity.knots,
        },
        { layerName },
      )
      break
    }
  }
}

// ─── Public API ───

/**
 * Generate a DXF string from an array of entities.
 * All entities are placed on a single layer (default: VISIBLE).
 */
export function generateDXF(
  entities: Entity[],
  options?: { layerName?: string },
): string {
  const dxf = setupDxf()
  const layer = options?.layerName ?? 'VISIBLE'

  for (const entity of entities) {
    writeEntity(dxf, entity, layer)
  }

  return dxf.stringify()
}

/**
 * Generate a DXF string from a LayoutResult (multi-view drawing).
 * Applies per-view offsets so views are correctly positioned.
 */
export function generateLayoutDXF(
  layout: LayoutResult,
  options?: { showHidden?: boolean },
): string {
  const dxf = setupDxf()

  for (const view of layout.views) {
    const offset = layout.offsets[view.viewKey]
    for (const entity of view.entities) {
      writeEntity(dxf, entity, 'VISIBLE', offset)
    }
  }

  return dxf.stringify()
}

/**
 * Browser download helper. Accepts either Entity[] or LayoutResult.
 * Generates DXF and triggers a file download via anchor click.
 */
export function exportEnhancedDXF(
  data: Entity[] | LayoutResult,
  options?: { showHidden?: boolean; fileName?: string },
): void {
  const content = isLayoutResult(data)
    ? generateLayoutDXF(data, { showHidden: options?.showHidden })
    : generateDXF(data)

  const fileName = options?.fileName ?? 'export'
  downloadBlob(content, 'application/dxf', `${fileName}.dxf`)
}
