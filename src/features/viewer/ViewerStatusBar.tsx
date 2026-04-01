'use client'

import { useTranslations } from 'next-intl'
import { useViewerStore } from '@/stores/useViewerStore'
import { LABELS } from '@/lib/viewer/constants'

const VIEW_LABEL_KEYS: Record<string, string> = {
  iso: LABELS.viewIso, front: LABELS.viewFront, back: LABELS.viewBack,
  left: LABELS.viewLeft, right: LABELS.viewRight,
  top: LABELS.viewTop, bottom: LABELS.viewBottom, free: LABELS.viewFree,
}

export function ViewerStatusBar() {
  const viewport = useViewerStore((s) => s.viewport)
  const measureMode = useViewerStore((s) => s.measureMode)
  const t = useTranslations('Viewer')

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-zinc-200 bg-white/80 backdrop-blur text-xs text-zinc-500">
      <div className="flex items-center gap-4">
        <span>{t('viewLabel')} {t(VIEW_LABEL_KEYS[viewport.currentView])}</span>
        <span>{t('projectionLabel')} {viewport.projectionMode === 'orthographic' ? t(LABELS.orthographic) : t(LABELS.perspective)}</span>
      </div>
      <div>
        {measureMode && (
          <span className="text-yellow-600 font-medium">{t(LABELS.measureHint)}</span>
        )}
      </div>
    </div>
  )
}
