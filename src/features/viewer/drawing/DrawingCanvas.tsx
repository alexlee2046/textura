'use client'

import { Suspense, lazy, useRef, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrthographicCamera, CameraControls } from '@react-three/drei'
import type { CameraControls as CameraControlsType } from '@react-three/drei'
import { useViewerStore } from '@/stores/useViewerStore'
import { CameraManager } from '../CameraManager'
import { WhiteModelBase } from './WhiteModelBase'
import { setGLContext, clearGLContext } from '@/lib/viewer/glContext'

const EdgesAlgorithm = lazy(() => import('./algorithms/EdgesAlgorithm'))
const SobelAlgorithm = lazy(() => import('./algorithms/SobelAlgorithm'))
const OutlinesAlgorithm = lazy(() => import('./algorithms/OutlinesAlgorithm'))
const ConditionalAlgorithm = lazy(() => import('./algorithms/ConditionalAlgorithm'))
const ProjectionAlgorithm = lazy(() => import('./algorithms/ProjectionAlgorithm'))
const CompositeAlgorithm = lazy(() => import('./algorithms/CompositeAlgorithm'))
const ThreeViewCanvas = lazy(() => import('./ThreeViewCanvas').then(m => ({ default: m.ThreeViewCanvas })))

function DrawingScene() {
  const model = useViewerStore((s) => s.loadedModel)
  const algo = useViewerStore((s) => s.activeAlgorithm)
  const controlsRef = useRef<CameraControlsType | null>(null)
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    setGLContext(gl, scene, camera)
    return () => clearGLContext()
  }, [gl, scene, camera])

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={50} near={0.01} far={100000} />
      <CameraControls ref={controlsRef} makeDefault />
      <CameraManager controlsRef={controlsRef} />

      {/* WhiteModelBase: Sobel needs it for depth/normal passes,
          other algos need it for depth occlusion. Sobel hides it via overrideMaterial.
          Projection algo outputs 2D geometry on XZ plane — skip WhiteModelBase to avoid occlusion. */}
      {algo !== 'projection' && algo !== 'composite' && <WhiteModelBase model={model} />}

      <Suspense fallback={null}>
        {algo === 'edges' && <EdgesAlgorithm />}
        {algo === 'sobel' && <SobelAlgorithm />}
        {algo === 'outlines' && <OutlinesAlgorithm />}
        {algo === 'conditional' && <ConditionalAlgorithm />}
        {algo === 'projection' && <ProjectionAlgorithm />}
        {algo === 'composite' && <CompositeAlgorithm />}
      </Suspense>
    </>
  )
}

export function DrawingCanvas() {
  const algo = useViewerStore((s) => s.activeAlgorithm)
  const threeViewMode = useViewerStore((s) => s.threeViewMode)

  if (algo === 'projection' && threeViewMode) {
    return (
      <Suspense fallback={null}>
        <ThreeViewCanvas />
      </Suspense>
    )
  }

  return (
    <Canvas
      orthographic
      frameloop={algo === 'sobel' ? 'always' : 'demand'}
      gl={{ preserveDrawingBuffer: true }}
      style={{ background: '#ffffff' }}
      className="w-full h-full"
    >
      <DrawingScene />
    </Canvas>
  )
}
