'use client'

import { useTranslations } from 'next-intl'
import { useViewerStore } from '@/stores/useViewerStore'
import { LABELS, type ViewPreset } from '@/lib/viewer/constants'
import {
  Box, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Eye, Compass,
} from 'lucide-react'

const VIEW_BUTTONS: { view: ViewPreset; labelKey: string; key: string }[] = [
  { view: 'iso', labelKey: LABELS.viewIso, key: '1' },
  { view: 'front', labelKey: LABELS.viewFront, key: '2' },
  { view: 'back', labelKey: LABELS.viewBack, key: '3' },
  { view: 'left', labelKey: LABELS.viewLeft, key: '4' },
  { view: 'right', labelKey: LABELS.viewRight, key: '5' },
  { view: 'top', labelKey: LABELS.viewTop, key: '6' },
  { view: 'bottom', labelKey: LABELS.viewBottom, key: '7' },
  { view: 'free', labelKey: LABELS.viewFree, key: '0' },
]

export function ViewControls() {
  const viewport = useViewerStore((s) => s.viewport)
  const setView = useViewerStore((s) => s.setView)
  const setProjection = useViewerStore((s) => s.setProjection)
  const t = useTranslations('Viewer')

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-zinc-500 uppercase">{t(LABELS.views)}</div>
      <div className="grid grid-cols-4 gap-1">
        {VIEW_BUTTONS.map(({ view, labelKey, key }) => {
          const label = t(labelKey)
          return (
            <button
              key={view}
              onClick={() => setView(view)}
              className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                viewport.currentView === view
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
              title={`${label} (${key})`}
            >
              {label}
            </button>
          )
        })}
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => setProjection('orthographic')}
          className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
            viewport.projectionMode === 'orthographic'
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          {t(LABELS.orthographic)}
        </button>
        <button
          onClick={() => setProjection('perspective')}
          className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
            viewport.projectionMode === 'perspective'
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          {t(LABELS.perspective)}
        </button>
      </div>
    </div>
  )
}
