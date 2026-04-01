import type { StateCreator } from 'zustand'
import type { ViewerStore, ModelSlice } from './types'

export const createModelSlice: StateCreator<ViewerStore, [], [], ModelSlice> = (set) => ({
  // Loading
  loadingState: 'idle',
  loadingProgress: 0,
  loadingError: null,
  setLoading: (progress) => set({ loadingState: 'loading', loadingProgress: progress }),
  setLoaded: () => set({ loadingState: 'loaded', loadingProgress: 100 }),
  setLoadError: (error) => set({ loadingState: 'error', loadingError: error }),
  resetLoading: () =>
    set({ loadingState: 'idle', loadingProgress: 0, loadingError: null }),

  // Model
  loadedModel: null,
  boundingBox: null,
  modelInfo: null,
  setModel: (model, bbox, info) =>
    set({ loadedModel: model, boundingBox: bbox, modelInfo: info }),
  clearModel: () =>
    set({
      loadedModel: null,
      boundingBox: null,
      modelInfo: null,
      loadingState: 'idle',
      loadingProgress: 0,
      loadingError: null,
      // Cross-slice reset: measure state
      measurements: [],
      measureMode: false,
      highlightedMeasureId: null,
    }),
})
