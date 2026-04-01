'use client'

import { useMemo } from 'react'
import { Vector3 } from 'three'
import { Line, Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useViewerStore } from '@/stores/useViewerStore'
import { ANNOTATIONS_VISIBLE_MAP } from '@/lib/viewer/constants'
import { formatWithUnit } from '@/lib/viewer/units'

type Axis = 'x' | 'y' | 'z'

const AXIS_COLORS: Record<Axis, string> = {
  x: '#ef4444',
  y: '#22c55e',
  z: '#3b82f6',
}

/** Offset distance as fraction of max dimension */
const OFFSET_RATIO = 0.25

/** Arrow cap length as fraction of the measured dimension */
const ARROW_RATIO = 0.05

/** Arrow cap half-angle (30°) */
const ARROW_ANGLE = Math.PI / 6

interface DimLine {
  axis: Axis
  /** Two extension lines: from bbox edge to annotation line */
  extA: [Vector3, Vector3]
  extB: [Vector3, Vector3]
  /** The dimension line itself (between extension line ends) */
  dimLine: [Vector3, Vector3]
  /** Arrow V-shapes at each end */
  arrowA: [Vector3, Vector3, Vector3] // cap1, tip, cap2
  arrowB: [Vector3, Vector3, Vector3]
  /** Label position and value */
  labelPos: Vector3
  mmValue: number
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  padding: '1px 5px',
  borderRadius: '3px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  userSelect: 'none',
  lineHeight: '1.4',
}

function makeArrow(
  tip: Vector3,
  dir: Vector3, // direction along dimension line, pointing inward
  perp: Vector3, // perpendicular direction
  len: number,
): [Vector3, Vector3, Vector3] {
  const cos = Math.cos(ARROW_ANGLE)
  const sin = Math.sin(ARROW_ANGLE)
  const c1 = tip.clone()
    .add(dir.clone().multiplyScalar(len * cos))
    .add(perp.clone().multiplyScalar(len * sin))
  const c2 = tip.clone()
    .add(dir.clone().multiplyScalar(len * cos))
    .add(perp.clone().multiplyScalar(-len * sin))
  return [c1, tip, c2]
}

export function BoundingBoxAnnotation() {
  const boundingBox = useViewerStore((s) => s.boundingBox)
  const showAnnotations = useViewerStore((s) => s.showAnnotations)
  const currentView = useViewerStore((s) => s.viewport.currentView)
  const unit = useViewerStore((s) => s.unit)
  const calibrationScale = useViewerStore((s) => s.calibrationScale)

  useThree(({ invalidate }) => { invalidate() })

  const lines = useMemo(() => {
    if (!boundingBox) return []

    const min = boundingBox.min.clone()
    const max = boundingBox.max.clone()
    const size = new Vector3()
    boundingBox.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const offset = maxDim * OFFSET_RATIO

    const result: DimLine[] = []

    // ── X (width) ──────────────────────────────────
    // Front-bottom edge, offset downward (-Y)
    // Separated from Z by being on the front face (z = max.z)
    {
      const y = min.y - offset
      const z = max.z
      const a = new Vector3(min.x, y, z)
      const b = new Vector3(max.x, y, z)
      const arrowLen = size.x * ARROW_RATIO
      result.push({
        axis: 'x',
        extA: [new Vector3(min.x, min.y, z), a],
        extB: [new Vector3(max.x, min.y, z), b],
        dimLine: [a, b],
        arrowA: makeArrow(a, new Vector3(1, 0, 0), new Vector3(0, -1, 0), arrowLen),
        arrowB: makeArrow(b, new Vector3(-1, 0, 0), new Vector3(0, -1, 0), arrowLen),
        labelPos: new Vector3((min.x + max.x) / 2, y, z),
        mmValue: size.x,
      })
    }

    // ── Y (height) ──────────────────────────────────
    // Left-front edge, offset to the left (-X)
    // Clearly on the left side, won't overlap with X or Z
    {
      const x = min.x - offset
      const z = max.z
      const a = new Vector3(x, min.y, z)
      const b = new Vector3(x, max.y, z)
      const arrowLen = size.y * ARROW_RATIO
      result.push({
        axis: 'y',
        extA: [new Vector3(min.x, min.y, z), a],
        extB: [new Vector3(min.x, max.y, z), b],
        dimLine: [a, b],
        arrowA: makeArrow(a, new Vector3(0, 1, 0), new Vector3(-1, 0, 0), arrowLen),
        arrowB: makeArrow(b, new Vector3(0, -1, 0), new Vector3(-1, 0, 0), arrowLen),
        labelPos: new Vector3(x, (min.y + max.y) / 2, z),
        mmValue: size.y,
      })
    }

    // ── Z (depth) ──────────────────────────────────
    // Right-bottom edge, offset to the right (+X)
    // On the right side, separated from Y (left) and X (front-bottom)
    {
      const x = max.x + offset
      const y = min.y
      const a = new Vector3(x, y, min.z)
      const b = new Vector3(x, y, max.z)
      const arrowLen = size.z * ARROW_RATIO
      result.push({
        axis: 'z',
        extA: [new Vector3(max.x, y, min.z), a],
        extB: [new Vector3(max.x, y, max.z), b],
        dimLine: [a, b],
        arrowA: makeArrow(a, new Vector3(0, 0, 1), new Vector3(1, 0, 0), arrowLen),
        arrowB: makeArrow(b, new Vector3(0, 0, -1), new Vector3(1, 0, 0), arrowLen),
        labelPos: new Vector3(x, y, (min.z + max.z) / 2),
        mmValue: size.z,
      })
    }

    return result
  }, [boundingBox])

  if (!boundingBox || !showAnnotations) return null

  const visibleAxes: Axis[] = ANNOTATIONS_VISIBLE_MAP[currentView] ?? ['x', 'y', 'z']

  return (
    <group>
      {lines
        .filter((d) => visibleAxes.includes(d.axis))
        .map((d) => {
          const color = AXIS_COLORS[d.axis]
          return (
            <group key={d.axis}>
              {/* Extension lines */}
              <Line points={d.extA} color={color} lineWidth={1} depthTest={false} renderOrder={999} />
              <Line points={d.extB} color={color} lineWidth={1} depthTest={false} renderOrder={999} />
              {/* Dimension line */}
              <Line points={d.dimLine} color={color} lineWidth={1.5} depthTest={false} renderOrder={999} />
              {/* Arrow caps */}
              <Line points={d.arrowA} color={color} lineWidth={1.5} depthTest={false} renderOrder={999} />
              <Line points={d.arrowB} color={color} lineWidth={1.5} depthTest={false} renderOrder={999} />
              {/* Label */}
              <Html position={d.labelPos} center zIndexRange={[999, 999]}>
                <span style={{
                  ...labelStyle,
                  color,
                  backgroundColor: 'rgba(255, 255, 255, 0.92)',
                  border: `1.5px solid ${color}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}>
                  {formatWithUnit(d.mmValue * calibrationScale, unit)}
                </span>
              </Html>
            </group>
          )
        })}
    </group>
  )
}
