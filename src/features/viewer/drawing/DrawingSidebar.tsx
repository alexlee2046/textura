'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useViewerStore } from '@/stores/useViewerStore'
import { DRAWING_LABELS, LABELS } from '@/lib/viewer/constants'
import type { ViewPreset } from '@/lib/viewer/constants'
import { useDrawingExport } from './hooks/useDrawingExport'

const VIEW_KEYS: { key: ViewPreset; labelKey: string }[] = [
  { key: 'front', labelKey: LABELS.viewFront },
  { key: 'back', labelKey: LABELS.viewBack },
  { key: 'left', labelKey: LABELS.viewLeft },
  { key: 'right', labelKey: LABELS.viewRight },
  { key: 'top', labelKey: LABELS.viewTop },
  { key: 'bottom', labelKey: LABELS.viewBottom },
  { key: 'iso', labelKey: LABELS.viewIso },
]

export function DrawingSidebar() {
  const setView = useViewerStore((s) => s.setView)
  const currentView = useViewerStore((s) => s.viewport.currentView)
  const angle = useViewerStore((s) => s.angleThreshold)
  const setAngle = useViewerStore((s) => s.setAngleThreshold)
  const lineWidth = useViewerStore((s) => s.drawingLineWidth)
  const setLineWidth = useViewerStore((s) => s.setDrawingLineWidth)
  const showHidden = useViewerStore((s) => s.showHiddenLines)
  const toggleHidden = useViewerStore((s) => s.toggleHiddenLines)
  const showIntersection = useViewerStore((s) => s.showIntersectionEdges)
  const toggleIntersection = useViewerStore((s) => s.toggleIntersectionEdges)
  const activeAlgo = useViewerStore((s) => s.activeAlgorithm)
  const stats = useViewerStore((s) => s.drawingStats)
  const threeViewMode = useViewerStore((s) => s.threeViewMode)
  const detailLevel = useViewerStore((s) => s.detailLevel)
  const cornerSensitivity = useViewerStore((s) => s.cornerSensitivity)
  const { exportPNG, exportPDF, exportDXFFile, exportEnhancedDXFFile, exportSVGFile, exportVectorizedDXF } = useDrawingExport()
  const t = useTranslations('Viewer')
  const [vectorizing, setVectorizing] = useState(false)

  return (
    <div className="w-64 h-full border-l border-zinc-200 bg-white/95 backdrop-blur-md overflow-y-auto p-3 pt-12 space-y-4">
      {/* View Presets */}
      <section className="space-y-1.5">
        <div className="text-xs font-medium text-zinc-500 uppercase">{t('drawing.viewPresets')}</div>
        <div className="grid grid-cols-4 gap-1">
          {VIEW_KEYS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              disabled={threeViewMode}
              className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                threeViewMode
                  ? 'bg-zinc-50 text-zinc-300 cursor-not-allowed'
                  : currentView === v.key
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {t(v.labelKey)}
            </button>
          ))}
        </div>
      </section>

      {/* Controls */}
      <section className="space-y-3">
        <div className="text-xs font-medium text-zinc-500 uppercase">{t('drawing.controls')}</div>

        {/* Hidden Lines Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-600">{t(DRAWING_LABELS.hiddenLines)}</span>
          <button
            onClick={toggleHidden}
            disabled={activeAlgo !== 'projection'}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              activeAlgo !== 'projection'
                ? 'bg-zinc-200 cursor-not-allowed opacity-50'
                : showHidden ? 'bg-zinc-900' : 'bg-zinc-300'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${showHidden ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        {/* Intersection Edges Toggle (projection only) */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-600">{t('drawing.intersectionEdges')}</span>
          <button
            onClick={toggleIntersection}
            disabled={activeAlgo !== 'projection'}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              activeAlgo !== 'projection'
                ? 'bg-zinc-200 cursor-not-allowed opacity-50'
                : showIntersection ? 'bg-zinc-900' : 'bg-zinc-300'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${showIntersection ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        {/* Angle Threshold */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-zinc-600">{t(DRAWING_LABELS.angleThreshold)}</span>
            <span className="text-xs text-zinc-400 font-mono">{angle}°</span>
          </div>
          <input type="range" min={1} max={90} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-full h-1.5 bg-zinc-200 rounded-full appearance-none cursor-pointer" />
        </div>

        {/* Line Width */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-zinc-600">{t(DRAWING_LABELS.lineWidth)}</span>
            <span className="text-xs text-zinc-400 font-mono">{lineWidth}px</span>
          </div>
          <input type="range" min={0.5} max={5} step={0.5} value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} className="w-full h-1.5 bg-zinc-200 rounded-full appearance-none cursor-pointer" />
        </div>
      </section>

      {/* Three-View Mode — only for projection algorithm */}
      {activeAlgo === 'projection' && (
        <section className="space-y-3">
          <div className="text-xs font-medium text-zinc-500 uppercase">{t('drawing.threeViewMode')}</div>

          {/* Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600">{t('drawing.threeViewMode')}</span>
            <button
              onClick={() => useViewerStore.getState().setThreeViewMode(!threeViewMode)}
              className={`relative w-10 h-5 rounded-full transition-colors ${threeViewMode ? 'bg-zinc-900' : 'bg-zinc-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${threeViewMode ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Detail Level */}
          <div>
            <span className="text-sm text-zinc-600 block mb-1">{t('drawing.detailLevel')}</span>
            <div className="grid grid-cols-3 gap-1">
              {(['low', 'medium', 'high'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => useViewerStore.getState().setDetailLevel(level)}
                  className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                    detailLevel === level
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {t(`drawing.detail${level.charAt(0).toUpperCase() + level.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Corner Sensitivity */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-zinc-600">{t('drawing.cornerSensitivity')}</span>
              <span className="text-xs text-zinc-400 font-mono">{cornerSensitivity}°</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-400">{t('drawing.smooth')}</span>
              <input type="range" min={20} max={60} step={5} value={cornerSensitivity}
                onChange={(e) => useViewerStore.getState().setCornerSensitivity(Number(e.target.value))}
                className="flex-1 h-1.5 bg-zinc-200 rounded-full appearance-none cursor-pointer" />
              <span className="text-[10px] text-zinc-400">{t('drawing.sharp')}</span>
            </div>
          </div>
        </section>
      )}

      {/* Performance Stats */}
      <section className="space-y-1.5">
        <div className="text-xs font-medium text-zinc-500 uppercase">{t(DRAWING_LABELS.performance)}</div>
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-zinc-500">{t(DRAWING_LABELS.computeTime)}</span>
            <span className="text-zinc-800 font-mono">{stats.computeTime.toFixed(0)}ms</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">{t(DRAWING_LABELS.lines)}</span>
            <span className="text-zinc-800 font-mono">{stats.lineCount.toLocaleString()}</span>
          </div>
          {activeAlgo === 'projection' && (
            <>
              <div className="flex justify-between">
                <span className="text-zinc-500">{t(DRAWING_LABELS.visible)}</span>
                <span className="text-zinc-800 font-mono">{stats.visibleLineCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">{t(DRAWING_LABELS.hidden)}</span>
                <span className="text-zinc-800 font-mono">{stats.hiddenLineCount.toLocaleString()}</span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Export */}
      <section className="space-y-1.5">
        <div className="text-xs font-medium text-zinc-500 uppercase">{t('drawing.export')}</div>
        <div className="flex flex-col gap-1.5">
          <button onClick={exportPNG} className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors">
            {t(DRAWING_LABELS.exportPNG)}
          </button>
          <button onClick={exportPDF} className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors">
            {t(DRAWING_LABELS.exportPDF)}
          </button>
          <button
            onClick={exportDXFFile}
            disabled={activeAlgo !== 'projection'}
            className={`w-full px-3 py-2 text-sm rounded-lg transition-colors ${
              activeAlgo === 'projection' ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200' : 'bg-zinc-50 text-zinc-300 cursor-not-allowed'
            }`}
          >
            {t(DRAWING_LABELS.exportDXF)}
            {activeAlgo !== 'projection' && <span className="block text-[10px] text-zinc-300">{t(DRAWING_LABELS.dxfOnlyAlgo4)}</span>}
          </button>
          {activeAlgo === 'projection' && (
            <>
              <button onClick={exportEnhancedDXFFile} className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors">
                {t('drawing.exportEnhancedDXF')}
              </button>
              <button onClick={exportSVGFile} className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors">
                {t('drawing.exportSVG')}
              </button>
            </>
          )}
          <button
            onClick={async () => {
              setVectorizing(true)
              try { await exportVectorizedDXF() }
              catch (e) { console.error('Vectorized DXF failed:', e) }
              finally { setVectorizing(false) }
            }}
            disabled={vectorizing}
            className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {vectorizing ? t('drawing.vectorizing') : t('drawing.exportVectorDXF')}
          </button>
        </div>
      </section>
    </div>
  )
}
