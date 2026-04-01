'use client'

import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  CameraControls,
  OrthographicCamera,
  PerspectiveCamera,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Bvh,
} from '@react-three/drei'
import type { CameraControls as CameraControlsType } from '@react-three/drei'
import { useViewerStore } from '@/stores/useViewerStore'
import { GRID_THRESHOLDS } from '@/lib/viewer/constants'
import { CameraManager } from './CameraManager'
import { ModelLoader } from './ModelLoader'
import { BoundingBoxAnnotation } from './BoundingBoxAnnotation'
import { MeasureTool } from './MeasureTool'

interface ViewerCanvasInnerProps {
  file: File | null
}

function SceneContent({ file }: { file: File | null }) {
  const controlsRef = useRef<CameraControlsType>(null)
  const viewport = useViewerStore((s) => s.viewport)
  const boundingBox = useViewerStore((s) => s.boundingBox)

  // Compute grid params from bounding box
  const maxDim = boundingBox
    ? Math.max(
        boundingBox.max.x - boundingBox.min.x,
        boundingBox.max.y - boundingBox.min.y,
        boundingBox.max.z - boundingBox.min.z,
      )
    : 1000
  const gridConfig = GRID_THRESHOLDS.find((t) => maxDim < t.maxDim) ?? GRID_THRESHOLDS[3]

  return (
    <>
      {/* Dual cameras -- switch via makeDefault */}
      <OrthographicCamera
        makeDefault={viewport.projectionMode === 'orthographic'}
        position={[10, 10, 10]}
        zoom={50}
        near={0.01}
        far={100000}
      />
      <PerspectiveCamera
        makeDefault={viewport.projectionMode === 'perspective'}
        position={[10, 10, 10]}
        fov={50}
        near={0.01}
        far={100000}
      />

      <CameraControls
        ref={controlsRef}
        makeDefault
        smoothTime={0.3}
      />

      <CameraManager controlsRef={controlsRef} />

      {/* Lighting: neutral, even illumination */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[0, 10, 0]} intensity={0.4} />
      <directionalLight position={[0, 0, 10]} intensity={0.4} />

      {/* Ground grid */}
      <Grid
        infiniteGrid
        cellSize={gridConfig.cellSize}
        sectionSize={gridConfig.sectionSize}
        cellColor="#cccccc"
        sectionColor="#999999"
        cellThickness={0.5}
        sectionThickness={1}
        fadeDistance={maxDim * 3}
        fadeStrength={1}
      />

      {/* Axis gizmo */}
      <GizmoHelper alignment="top-right" margin={[60, 60]}>
        <GizmoViewport
          axisColors={['#ef4444', '#22c55e', '#3b82f6']}
          labelColor="black"
        />
      </GizmoHelper>

      {/* Model + annotations mount here (via Bvh wrapper) */}
      <Bvh firstHitOnly>
        <ModelLoader file={file} />
        <BoundingBoxAnnotation />
        <MeasureTool />
      </Bvh>
    </>
  )
}

export function ViewerCanvasInner({ file }: ViewerCanvasInnerProps) {
  return (
    <Canvas
      frameloop="demand"
      className="w-full h-full"
      gl={{ preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        // Capture WebGL context loss
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          console.error('WebGL context lost')
          alert('GPU 内存不足，请使用更轻量的模型或关闭其他浏览器标签')
        })
      }}
    >
      <SceneContent file={file} />
    </Canvas>
  )
}
