import type { StateCreator } from 'zustand'
import type { ViewerStore, MeasureSlice } from './types'

export const createMeasureSlice: StateCreator<ViewerStore, [], [], MeasureSlice> = (set) => ({
  measureMode: false,
  toggleMeasureMode: () => set((s) => ({ measureMode: !s.measureMode })),
  measurements: [],
  addMeasurement: (m) =>
    set((s) => ({ measurements: [...s.measurements, m] })),
  removeMeasurement: (id) =>
    set((s) => ({ measurements: s.measurements.filter((m) => m.id !== id) })),
  clearMeasurements: () => set({ measurements: [] }),
  highlightedMeasureId: null,
  setHighlightedMeasureId: (id) => set({ highlightedMeasureId: id }),
})
