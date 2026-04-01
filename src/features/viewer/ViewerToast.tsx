'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useViewerStore } from '@/stores/useViewerStore'
import { AlertTriangle, Info, X } from 'lucide-react'

const STYLE_MAP = {
  error: 'bg-red-50 border-red-200 text-red-600',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  info: 'bg-zinc-50 border-zinc-200 text-zinc-600',
} as const

export function ViewerToast() {
  const message = useViewerStore((s) => s.toastMessage)
  const type = useViewerStore((s) => s.toastType)
  const clearToast = useViewerStore((s) => s.clearToast)

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          className={`absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium shadow-lg ${STYLE_MAP[type]}`}
        >
          {type === 'error' || type === 'warning' ? (
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          ) : (
            <Info className="h-4 w-4 flex-shrink-0" />
          )}
          {message}
          <button onClick={clearToast} className="ml-1 rounded-full p-0.5 hover:bg-black/5 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
