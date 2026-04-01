import type { StateCreator } from 'zustand'
import type { ViewerStore, DisplaySlice } from './types'

export const createDisplaySlice: StateCreator<ViewerStore, [], [], DisplaySlice> = (
  set,
  get,
) => ({
  showAnnotations: true,
  toggleAnnotations: () => set((s) => ({ showAnnotations: !s.showAnnotations })),
  displayMode: 'solid',
  setDisplayMode: (mode) => set({ displayMode: mode }),
  toggleDisplayMode: () =>
    set((s) => ({ displayMode: s.displayMode === 'solid' ? 'wireframe' : 'solid' })),
  unit: 'mm',
  setUnit: (unit) => set({ unit }),
  manualScale: 1,
  setManualScale: (scale) => set({ manualScale: scale }),

  calibrationScale: 1,
  calibrate: (axis, realValue) => {
    // Cross-slice read: access modelInfo from ModelSlice via get()
    const { modelInfo } = get()
    if (!modelInfo) return
    const raw = modelInfo.dimensions[axis]
    if (raw <= 0) return
    set({ calibrationScale: realValue / raw })
  },
  resetCalibration: () => set({ calibrationScale: 1 }),
})
