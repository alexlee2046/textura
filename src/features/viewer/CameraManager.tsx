import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { type CameraControls as CameraControlsType } from '@react-three/drei'
import { Box3, Vector3 } from 'three'
import { useViewerStore } from '@/stores/useViewerStore'
import { VIEW_PRESETS } from '@/lib/viewer/constants'

// Import ACTION enum from camera-controls
import CameraControlsImpl from 'camera-controls'

interface CameraManagerProps {
  controlsRef: React.RefObject<CameraControlsType | null>
}

export function CameraManager({ controlsRef }: CameraManagerProps) {
  const { invalidate } = useThree()
  const viewport = useViewerStore((s) => s.viewport)
  const boundingBox = useViewerStore((s) => s.boundingBox)
  const measureMode = useViewerStore((s) => s.measureMode)
  const fitCounter = useViewerStore((s) => s.fitCounter)
  const setInvalidateFn = useViewerStore((s) => s.setInvalidateFn)
  const activeAlgorithm = useViewerStore((s) => s.activeAlgorithm)
  const isDrawingMode = useViewerStore((s) => s.isDrawingMode)
  const prevViewRef = useRef(viewport.currentView)
  const isProjection = isDrawingMode && activeAlgorithm === 'projection'

  // Register invalidate fn for use outside Canvas (e.g., sidebar rotation)
  useEffect(() => {
    setInvalidateFn(invalidate)
  }, [invalidate, setInvalidateFn])

  // Calculate camera distance based on bounding box
  const distance = boundingBox
    ? new Vector3().subVectors(boundingBox.max, boundingBox.min).length() * 2
    : 10

  /** Move camera to a preset view and fit the model into viewport */
  const goToPresetView = (
    viewKey: keyof typeof VIEW_PRESETS,
    animate: boolean,
  ) => {
    const controls = controlsRef.current
    if (!controls || !boundingBox) return

    const preset = VIEW_PRESETS[viewKey]

    // Set up vector BEFORE setLookAt so camera orientation is correct
    controls.camera.up.set(preset.up[0], preset.up[1], preset.up[2])

    const pos = [
      preset.position[0] * distance,
      preset.position[1] * distance,
      preset.position[2] * distance,
    ] as const

    controls.setLookAt(
      pos[0], pos[1], pos[2],
      preset.target[0], preset.target[1], preset.target[2],
      animate,
    )

    // fitToBox auto-adjusts zoom for orthographic camera and distance for perspective
    // padding 0.2 = 20% margin
    const box = new Box3().copy(boundingBox)
    controls.fitToBox(box, animate, { paddingLeft: 0.2, paddingRight: 0.2, paddingTop: 0.2, paddingBottom: 0.2 })

    invalidate()
  }

  /**
   * Projection algorithm outputs geometry on XZ plane (y=0).
   * Camera must look down Y+ axis to see it correctly.
   */
  const goToProjectionView = (animate: boolean) => {
    const controls = controlsRef.current
    if (!controls || !boundingBox) return

    // Look down from Y+ onto XZ plane, up = -Z (engineering drawing convention)
    controls.camera.up.set(0, 0, -1)
    controls.setLookAt(0, distance, 0, 0, 0, 0, animate)

    const box = new Box3().copy(boundingBox)
    controls.fitToBox(box, animate, { paddingLeft: 0.2, paddingRight: 0.2, paddingTop: 0.2, paddingBottom: 0.2 })

    invalidate()
  }

  // React to view changes
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    if (isProjection) {
      // Projection mode: always look down Y+ onto XZ plane regardless of selected view
      const shouldAnimate = prevViewRef.current !== viewport.currentView
      goToProjectionView(shouldAnimate)

      controls.mouseButtons.left = CameraControlsImpl.ACTION.TRUCK
      controls.mouseButtons.right = CameraControlsImpl.ACTION.NONE
      controls.touches.one = CameraControlsImpl.ACTION.TOUCH_TRUCK
    } else if (viewport.currentView === 'free') {
      // Free mode: enable rotation
      controls.mouseButtons.left = CameraControlsImpl.ACTION.ROTATE
      controls.mouseButtons.right = CameraControlsImpl.ACTION.TRUCK
      controls.touches.one = CameraControlsImpl.ACTION.TOUCH_ROTATE
    } else {
      const shouldAnimate = prevViewRef.current !== viewport.currentView
      goToPresetView(viewport.currentView, shouldAnimate)

      controls.mouseButtons.left = CameraControlsImpl.ACTION.TRUCK
      controls.mouseButtons.right = CameraControlsImpl.ACTION.NONE
      controls.touches.one = CameraControlsImpl.ACTION.TOUCH_TRUCK
    }

    prevViewRef.current = viewport.currentView
    invalidate()
  }, [viewport.currentView, controlsRef, distance, invalidate, boundingBox, isProjection])

  // Auto-fit camera when model loads or F key pressed (fitCounter changes)
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls || !boundingBox) return

    if (isProjection) {
      goToProjectionView(true)
    } else {
      // Position at iso angle
      const preset = VIEW_PRESETS.iso
      controls.camera.up.set(preset.up[0], preset.up[1], preset.up[2])
      const pos = [
        preset.position[0] * distance,
        preset.position[1] * distance,
        preset.position[2] * distance,
      ] as const
      controls.setLookAt(pos[0], pos[1], pos[2], 0, 0, 0, true)

      // Fit to bounding box with padding
      const box = new Box3().copy(boundingBox)
      controls.fitToBox(box, true, { paddingLeft: 0.2, paddingRight: 0.2, paddingTop: 0.2, paddingBottom: 0.2 })
    }
    invalidate()
  }, [fitCounter, boundingBox, controlsRef, distance, invalidate, isProjection])

  // Re-position camera when entering/leaving projection mode
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls || !boundingBox) return

    if (isProjection) {
      goToProjectionView(true)
    } else if (viewport.currentView !== 'free') {
      goToPresetView(viewport.currentView, true)
    }
  }, [isProjection])

  // React to measure mode changes
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    if (measureMode) {
      // Measure mode: left click captured by MeasureTool, middle = pan, right = rotate
      controls.mouseButtons.left = CameraControlsImpl.ACTION.NONE
      controls.mouseButtons.middle = CameraControlsImpl.ACTION.TRUCK
      controls.mouseButtons.right = CameraControlsImpl.ACTION.ROTATE
    } else if (viewport.currentView === 'free') {
      controls.mouseButtons.left = CameraControlsImpl.ACTION.ROTATE
      controls.mouseButtons.middle = CameraControlsImpl.ACTION.TRUCK
      controls.mouseButtons.right = CameraControlsImpl.ACTION.TRUCK
    } else {
      controls.mouseButtons.left = CameraControlsImpl.ACTION.TRUCK
      controls.mouseButtons.middle = CameraControlsImpl.ACTION.TRUCK
      controls.mouseButtons.right = CameraControlsImpl.ACTION.NONE
    }

    invalidate()
  }, [measureMode, viewport.currentView, controlsRef, invalidate])

  return null
}
