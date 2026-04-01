'use client'

import { useEffect, useRef, Suspense } from 'react'
import { Box3, Vector3 } from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { OrthographicCamera, CameraControls } from '@react-three/drei'
import type { CameraControls as CameraControlsType } from '@react-three/drei'
import CameraControlsImpl from 'camera-controls'
import { useViewerStore } from '@/stores/useViewerStore'
import { useThreeViewProjection } from './hooks/useThreeViewProjection'
import type { ViewKey } from '@/lib/viewer/projection/types'

function ThreeViewScene() {
  const model = useViewerStore((s) => s.loadedModel)
  const lineWidth = useViewerStore((s) => s.drawingLineWidth)
  const { layout, viewGeometries } = useThreeViewProjection(model)
  const controlsRef = useRef<CameraControlsType | null>(null)
  const { invalidate } = useThree()

  // Fit camera to layout bounding box
  useEffect(() => {
    if (!layout || !controlsRef.current) return
    const controls = controlsRef.current
    const { totalBBox } = layout

    // Engineering drawing convention: look down Y+, -Z is up on screen
    controls.camera.up.set(0, 0, -1)

    const cx = (totalBBox.min.x + totalBBox.max.x) / 2
    const cz = (totalBBox.min.y + totalBBox.max.y) / 2
    const dist = Math.max(totalBBox.width, totalBBox.height) * 2

    controls.setLookAt(cx, dist, cz, cx, 0, cz, false)

    // fitToBox auto-adjusts zoom for orthographic camera
    const box = new Box3(
      new Vector3(totalBBox.min.x, -0.1, totalBBox.min.y),
      new Vector3(totalBBox.max.x, 0.1, totalBBox.max.y),
    )
    controls.fitToBox(box, false, { paddingLeft: 0.1, paddingRight: 0.1, paddingTop: 0.1, paddingBottom: 0.1 })

    // Pan only (no rotation) for drawing mode
    controls.mouseButtons.left = CameraControlsImpl.ACTION.TRUCK
    controls.mouseButtons.right = CameraControlsImpl.ACTION.NONE
    controls.touches.one = CameraControlsImpl.ACTION.TOUCH_TRUCK

    invalidate()
  }, [layout, invalidate])

  if (!layout || !viewGeometries) return null

  const viewKeys: ViewKey[] = ['front', 'left', 'top']

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 10, 0]} zoom={50} near={0.01} far={100000} />
      <CameraControls ref={controlsRef} makeDefault />

      {viewKeys.map((viewKey) => {
        const offset = layout.offsets[viewKey]
        const viewBbox = layout.views.find(v => v.viewKey === viewKey)!.bbox
        const geom = viewGeometries[viewKey]
        if (!geom) return null
        return (
          <group key={viewKey} position={[
            offset.x - viewBbox.min.x,
            0,
            offset.y - viewBbox.min.y,
          ]}>
            <lineSegments geometry={geom}>
              <lineBasicMaterial color={0x000000} linewidth={lineWidth} depthWrite={false} depthTest={false} />
            </lineSegments>
          </group>
        )
      })}
    </>
  )
}

export function ThreeViewCanvas() {
  return (
    <Canvas
      orthographic
      frameloop="demand"
      gl={{ preserveDrawingBuffer: true }}
      style={{ background: '#ffffff' }}
      className="w-full h-full"
    >
      <Suspense fallback={null}>
        <ThreeViewScene />
      </Suspense>
    </Canvas>
  )
}
