'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Vector3 } from 'three'
import { Line, Html } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useViewerStore } from '@/stores/useViewerStore'
import { formatWithUnit } from '@/lib/viewer/units'
import { LABELS } from '@/lib/viewer/constants'

/** Maximum number of saved measurements */
const MAX_MEASUREMENTS = 20

const MEASURE_COLOR = '#eab308'
const HIGHLIGHT_COLOR = '#ffffff'

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  padding: '2px 6px',
  borderRadius: '3px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  userSelect: 'none',
  color: '#ffffff',
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
}

/**
 * R3F inner component: two-point measurement tool.
 *
 * When `measureMode` is active, provides:
 * - Hover marker (yellow sphere) on model surface
 * - Click-to-place pointA / pointB workflow
 * - Live dashed line + distance label between pointA and cursor
 * - Renders all saved measurements as dashed lines with labels
 * - Highlights measurement matching `highlightedMeasureId`
 * - Esc cancels in-progress measurement
 */
export function MeasureTool() {
  const { invalidate } = useThree()

  const measureMode = useViewerStore((s) => s.measureMode)
  const measurements = useViewerStore((s) => s.measurements)
  const highlightedMeasureId = useViewerStore((s) => s.highlightedMeasureId)
  const addMeasurement = useViewerStore((s) => s.addMeasurement)
  const boundingBox = useViewerStore((s) => s.boundingBox)
  const unit = useViewerStore((s) => s.unit)
  const loadedModel = useViewerStore((s) => s.loadedModel)

  // Local state for in-progress measurement
  const [pointA, setPointA] = useState<Vector3 | null>(null)
  const [hoverPoint, setHoverPoint] = useState<Vector3 | null>(null)

  // Compute marker radius from bounding box
  const markerRadius = (() => {
    if (!boundingBox) return 1
    const size = new Vector3()
    boundingBox.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    return maxDim * 0.005
  })()

  // Reset in-progress measurement when measureMode is toggled off
  const prevMeasureMode = useRef(measureMode)
  useEffect(() => {
    if (prevMeasureMode.current && !measureMode) {
      setPointA(null)
      setHoverPoint(null)
    }
    prevMeasureMode.current = measureMode
  }, [measureMode])

  // Esc key: cancel in-progress measurement (pointA set, no pointB yet)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && pointA) {
        setPointA(null)
        setHoverPoint(null)
        invalidate()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pointA, invalidate])

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!measureMode) return
      event.stopPropagation()
      setHoverPoint(event.point.clone())
      invalidate()
    },
    [measureMode, invalidate],
  )

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (!measureMode) return
      event.stopPropagation()

      const clickPoint = event.point.clone()

      if (!pointA) {
        // First click: set pointA
        setPointA(clickPoint)
        invalidate()
      } else {
        // Second click: complete measurement
        if (measurements.length >= MAX_MEASUREMENTS) {
          console.warn(LABELS.measureLimit)
          return
        }

        const distance = pointA.distanceTo(clickPoint)
        const delta = {
          x: Math.abs(clickPoint.x - pointA.x),
          y: Math.abs(clickPoint.y - pointA.y),
          z: Math.abs(clickPoint.z - pointA.z),
        }

        addMeasurement({
          id: crypto.randomUUID(),
          pointA: pointA.clone(),
          pointB: clickPoint,
          distance,
          delta,
        })

        setPointA(null)
        invalidate()
      }
    },
    [measureMode, pointA, measurements.length, addMeasurement, invalidate],
  )

  const handlePointerLeave = useCallback(() => {
    setHoverPoint(null)
    invalidate()
  }, [invalidate])

  // Compute midpoint helper
  function midpoint(a: Vector3, b: Vector3): Vector3 {
    return new Vector3().addVectors(a, b).multiplyScalar(0.5)
  }

  // Nothing to render if no model
  if (!loadedModel) return null

  return (
    <group>
      {/* Invisible interaction mesh: capture pointer events on the model group */}
      {/* We re-render the model's primitive with pointer events when in measure mode */}
      {measureMode && (
        <group
          onPointerMove={handlePointerMove}
          onClick={handleClick}
          onPointerLeave={handlePointerLeave}
        >
          {/* Transparent overlay that follows model geometry for raycasting.
              The actual model is rendered by ModelLoader -- we add a second
              invisible clone of the primitive here just to capture pointer events.
              Instead, we attach events to the loaded model directly. */}
          <primitive object={loadedModel} visible={false} />
        </group>
      )}

      {/* Hover marker */}
      {measureMode && hoverPoint && (
        <mesh position={hoverPoint} renderOrder={1000}>
          <sphereGeometry args={[markerRadius, 16, 16]} />
          <meshBasicMaterial color={MEASURE_COLOR} depthTest={false} transparent opacity={0.9} />
        </mesh>
      )}

      {/* PointA marker (placed, waiting for pointB) */}
      {pointA && (
        <mesh position={pointA} renderOrder={1000}>
          <sphereGeometry args={[markerRadius, 16, 16]} />
          <meshBasicMaterial color={MEASURE_COLOR} depthTest={false} />
        </mesh>
      )}

      {/* Live measurement line: pointA -> cursor */}
      {pointA && hoverPoint && (
        <>
          <Line
            points={[pointA, hoverPoint]}
            color={MEASURE_COLOR}
            lineWidth={1.5}
            dashed
            dashSize={markerRadius * 4}
            gapSize={markerRadius * 2}
            depthTest={false}
            renderOrder={1000}
          />
          <Html position={midpoint(pointA, hoverPoint)} center zIndexRange={[1000, 1000]}>
            <span style={labelStyle}>
              {formatWithUnit(pointA.distanceTo(hoverPoint), unit)}
            </span>
          </Html>
        </>
      )}

      {/* Saved measurements */}
      {measurements.map((m) => {
        const isHighlighted = m.id === highlightedMeasureId
        const lineColor = isHighlighted ? HIGHLIGHT_COLOR : MEASURE_COLOR
        const lineWidth = isHighlighted ? 2.5 : 1.5
        const mid = midpoint(m.pointA, m.pointB)

        return (
          <group key={m.id}>
            {/* Measurement line */}
            <Line
              points={[m.pointA, m.pointB]}
              color={lineColor}
              lineWidth={lineWidth}
              dashed
              dashSize={markerRadius * 4}
              gapSize={markerRadius * 2}
              depthTest={false}
              renderOrder={1000}
            />
            {/* PointA marker */}
            <mesh position={m.pointA} renderOrder={1000}>
              <sphereGeometry args={[markerRadius, 16, 16]} />
              <meshBasicMaterial color={lineColor} depthTest={false} />
            </mesh>
            {/* PointB marker */}
            <mesh position={m.pointB} renderOrder={1000}>
              <sphereGeometry args={[markerRadius, 16, 16]} />
              <meshBasicMaterial color={lineColor} depthTest={false} />
            </mesh>
            {/* Distance label */}
            <Html position={mid} center zIndexRange={[1000, 1000]}>
              <span
                style={{
                  ...labelStyle,
                  ...(isHighlighted
                    ? { backgroundColor: 'rgba(234, 179, 8, 0.95)', color: '#000' }
                    : {}),
                }}
              >
                {formatWithUnit(m.distance, unit)}
              </span>
            </Html>
          </group>
        )
      })}
    </group>
  )
}
