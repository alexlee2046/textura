'use client'

import { useTranslations } from 'next-intl'
import { useViewerStore } from '@/stores/useViewerStore'
import { DRAWING_ALGORITHMS, ALGORITHM_LABELS } from '@/lib/viewer/constants'
import type { DrawingAlgorithm } from '@/lib/viewer/drawingTypes'

export function DrawingAlgorithmBar() {
  const active = useViewerStore((s) => s.activeAlgorithm)
  const setAlgo = useViewerStore((s) => s.setActiveAlgorithm)
  const t = useTranslations('Viewer')

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <span className="text-xs text-zinc-500 mr-2">{t('drawing.algorithmLabel')}</span>
      {DRAWING_ALGORITHMS.map((algo) => (
        <button
          key={algo}
          onClick={() => setAlgo(algo as DrawingAlgorithm)}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            active === algo
              ? 'bg-zinc-900 text-white'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          {t(ALGORITHM_LABELS[algo])}
        </button>
      ))}
    </div>
  )
}
