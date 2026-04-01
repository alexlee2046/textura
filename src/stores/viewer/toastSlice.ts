import type { StateCreator } from 'zustand'
import type { ViewerStore, ToastSlice } from './types'

export const createToastSlice: StateCreator<ViewerStore, [], [], ToastSlice> = (set) => ({
  toastMessage: null,
  toastType: 'error',
  showToast: (message, type = 'error') => {
    set({ toastMessage: message, toastType: type })
    setTimeout(() => set({ toastMessage: null }), 4000)
  },
  clearToast: () => set({ toastMessage: null }),
})
