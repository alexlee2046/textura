import type { StateCreator } from 'zustand'
import type { DrawingAlgorithm } from '@/lib/viewer/drawingTypes'
import type { DetailLevel } from '@/lib/viewer/projection/types'
import type { ViewerStore, DrawingSlice } from './types'

export const createDrawingSlice: StateCreator<ViewerStore, [], [], DrawingSlice> = (set) => ({
  isDrawingMode: false,
  activeAlgorithm: 'edges' as DrawingAlgorithm,
  angleThreshold: 70,  // was 50, raised for furniture models per spec
  drawingLineWidth: 1.5,
  showHiddenLines: true,
  showIntersectionEdges: false,
  sobelDepthWeight: 25.0,
  sobelNormalWeight: 1.0,
  sobelThreshold: 0.05,
  isProjecting: false,
  projectionProgress: 0,
  projectionPhase: '',
  projectionError: null,
  drawingStats: { computeTime: 0, lineCount: 0, visibleLineCount: 0, hiddenLineCount: 0 },
  threeViewMode: false,
  detailLevel: 'medium' as DetailLevel,
  cornerSensitivity: 45,
  threeViewProgress: 0,

  setDrawingMode: (enabled) => set({ isDrawingMode: enabled }),
  setActiveAlgorithm: (algo) => set({ activeAlgorithm: algo }),
  setAngleThreshold: (degrees) => set({ angleThreshold: degrees }),
  setDrawingLineWidth: (px) => set({ drawingLineWidth: px }),
  toggleHiddenLines: () => set((s) => ({ showHiddenLines: !s.showHiddenLines })),
  toggleIntersectionEdges: () => set((s) => ({ showIntersectionEdges: !s.showIntersectionEdges })),
  setProjectionProgress: (progress, phase) =>
    set({ projectionProgress: progress, projectionPhase: phase }),
  setProjectionError: (error) => set({ projectionError: error }),
  setDrawingStats: (stats) => set({ drawingStats: stats }),
  setThreeViewMode: (enabled) => set({ threeViewMode: enabled }),
  setDetailLevel: (level) => set({ detailLevel: level }),
  setCornerSensitivity: (angle) => set({ cornerSensitivity: angle }),
  setThreeViewProgress: (progress) => set({ threeViewProgress: progress }),
})
