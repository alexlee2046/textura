import type { StateCreator } from 'zustand'
import type { ViewerStore, ViewportSlice } from './types'

export const createViewportSlice: StateCreator<ViewerStore, [], [], ViewportSlice> = (set) => ({
  viewport: { currentView: 'free', projectionMode: 'perspective' },
  setView: (view) =>
    set((s) => ({
      viewport: {
        ...s.viewport,
        currentView: view,
        // Preset ortho views force orthographic; free keeps current
        projectionMode: view !== 'free' ? 'orthographic' : s.viewport.projectionMode,
      },
    })),
  setProjection: (mode) =>
    set((s) => ({ viewport: { ...s.viewport, projectionMode: mode } })),

  fitCounter: 0,
  requestFit: () => set((s) => ({ fitCounter: s.fitCounter + 1 })),

  invalidateFn: null,
  setInvalidateFn: (fn) => set({ invalidateFn: fn }),
})
