import type { Object3D, Box3, Vector3 } from 'three'
import type { ViewPreset, Unit } from '@/lib/viewer/constants'
import type { DrawingAlgorithm, DrawingStats } from '@/lib/viewer/drawingTypes'
import type { DetailLevel } from '@/lib/viewer/projection/types'

export interface ViewportState {
  currentView: ViewPreset
  projectionMode: 'orthographic' | 'perspective'
}

export interface Measurement {
  id: string
  pointA: Vector3
  pointB: Vector3
  distance: number
  delta: { x: number; y: number; z: number }
}

export interface ModelInfo {
  fileName: string
  vertexCount: number
  faceCount: number
  textureCount: number
  dimensions: { x: number; y: number; z: number }
}

// --- Slice interfaces ---

export interface ModelSlice {
  loadingState: 'idle' | 'loading' | 'loaded' | 'error'
  loadingProgress: number
  loadingError: string | null
  setLoading: (progress: number) => void
  setLoaded: () => void
  setLoadError: (error: string) => void
  resetLoading: () => void

  loadedModel: Object3D | null
  boundingBox: Box3 | null
  modelInfo: ModelInfo | null
  setModel: (model: Object3D, bbox: Box3, info: ModelInfo) => void
  clearModel: () => void
}

export interface ViewportSlice {
  viewport: ViewportState
  setView: (view: ViewPreset) => void
  setProjection: (mode: 'orthographic' | 'perspective') => void

  fitCounter: number
  requestFit: () => void

  invalidateFn: (() => void) | null
  setInvalidateFn: (fn: () => void) => void
}

export interface DisplaySlice {
  showAnnotations: boolean
  toggleAnnotations: () => void
  displayMode: 'solid' | 'wireframe'
  setDisplayMode: (mode: 'solid' | 'wireframe') => void
  toggleDisplayMode: () => void
  unit: Unit
  setUnit: (unit: Unit) => void
  manualScale: number
  setManualScale: (scale: number) => void

  calibrationScale: number
  calibrate: (axis: 'x' | 'y' | 'z', realValue: number) => void
  resetCalibration: () => void
}

export interface MeasureSlice {
  measureMode: boolean
  toggleMeasureMode: () => void
  measurements: Measurement[]
  addMeasurement: (m: Measurement) => void
  removeMeasurement: (id: string) => void
  clearMeasurements: () => void
  highlightedMeasureId: string | null
  setHighlightedMeasureId: (id: string | null) => void
}

export interface DrawingSlice {
  isDrawingMode: boolean
  activeAlgorithm: DrawingAlgorithm
  angleThreshold: number
  drawingLineWidth: number
  showHiddenLines: boolean
  showIntersectionEdges: boolean
  sobelDepthWeight: number
  sobelNormalWeight: number
  sobelThreshold: number
  isProjecting: boolean
  projectionProgress: number
  projectionPhase: string
  projectionError: string | null
  drawingStats: DrawingStats

  threeViewMode: boolean
  detailLevel: DetailLevel
  cornerSensitivity: number
  threeViewProgress: number

  setDrawingMode: (enabled: boolean) => void
  setActiveAlgorithm: (algo: DrawingAlgorithm) => void
  setAngleThreshold: (degrees: number) => void
  setDrawingLineWidth: (px: number) => void
  toggleHiddenLines: () => void
  toggleIntersectionEdges: () => void
  setProjectionProgress: (progress: number, phase: string) => void
  setProjectionError: (error: string | null) => void
  setDrawingStats: (stats: DrawingStats) => void
  setThreeViewMode: (enabled: boolean) => void
  setDetailLevel: (level: DetailLevel) => void
  setCornerSensitivity: (angle: number) => void
  setThreeViewProgress: (progress: number) => void
}

export interface ToastSlice {
  toastMessage: string | null
  toastType: 'error' | 'warning' | 'info'
  showToast: (message: string, type?: 'error' | 'warning' | 'info') => void
  clearToast: () => void
}

export type ViewerStore = ModelSlice &
  ViewportSlice &
  DisplaySlice &
  MeasureSlice &
  DrawingSlice &
  ToastSlice
