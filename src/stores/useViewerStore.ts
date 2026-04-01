import { create } from 'zustand'
import type { ViewerStore } from './viewer/types'
import { createModelSlice } from './viewer/modelSlice'
import { createViewportSlice } from './viewer/viewportSlice'
import { createDisplaySlice } from './viewer/displaySlice'
import { createMeasureSlice } from './viewer/measureSlice'
import { createDrawingSlice } from './viewer/drawingSlice'
import { createToastSlice } from './viewer/toastSlice'

export type { Measurement, ModelInfo, ViewportState, ViewerStore } from './viewer/types'

export const useViewerStore = create<ViewerStore>()((...a) => ({
  ...createModelSlice(...a),
  ...createViewportSlice(...a),
  ...createDisplaySlice(...a),
  ...createMeasureSlice(...a),
  ...createDrawingSlice(...a),
  ...createToastSlice(...a),
}))
