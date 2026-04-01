'use client'

import { useTranslations } from 'next-intl'
import { useViewerStore } from '@/stores/useViewerStore'
import { ALGORITHM_LABELS, DRAWING_LABELS, LABELS } from '@/lib/viewer/constants'

const VIEW_LABEL_KEYS: Record<string, string> = {
  front: LABELS.viewFront, back: LABELS.viewBack,
  left: LABELS.viewLeft, right: LABELS.viewRight,
  top: LABELS.viewTop, bottom: LABELS.viewBottom,
  iso: LABELS.viewIso, free: LABELS.viewFree,
}

export function DrawingStatusBar() {
  const active = useViewerStore((s) => s.activeAlgorithm)
  const view = useViewerStore((s) => s.viewport.currentView)
  const angle = useViewerStore((s) => s.angleThreshold)
  const isProjecting = useViewerStore((s) => s.isProjecting)
  const projectionPhase = useViewerStore((s) => s.projectionPhase)
  const t = useTranslations('Viewer')

  const status = isProjecting ? `${t(DRAWING_LABELS.computing)} ${projectionPhase}` : t(DRAWING_LABELS.computed)

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-zinc-200 bg-white/80 backdrop-blur text-xs text-zinc-500">
      <div className="flex items-center gap-4">
        <span>{status}</span>
        <span>{t(ALGORITHM_LABELS[active])}</span>
        <span>{t('viewLabel')} {t(VIEW_LABEL_KEYS[view] ?? LABELS.viewFree)}</span>
        <span>{t('drawing.thresholdLabel')} {angle}°</span>
      </div>
    </div>
  )
}
