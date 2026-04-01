'use client'

import { useCallback, useEffect, useState, type DragEvent } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useViewerStore } from '@/stores/useViewerStore'
import { ViewerCanvas } from './ViewerCanvas'
import { ViewerToolbar } from './ViewerToolbar'
import { ViewerSidebar } from './ViewerSidebar'
import { DropZone } from './DropZone'
import { ViewerStatusBar } from './ViewerStatusBar'
import { DrawingAlgorithmBar } from './drawing/DrawingAlgorithmBar'
import { DrawingSidebar } from './drawing/DrawingSidebar'
import { DrawingStatusBar } from './drawing/DrawingStatusBar'
import { isSupportedFormat } from '@/lib/viewer/loaders'
import { MAX_FILE_SIZE, WARN_FILE_SIZE, LABELS, type ViewPreset } from '@/lib/viewer/constants'
import type { DrawingAlgorithm } from '@/lib/viewer/drawingTypes'
import { PanelRightOpen, PanelRightClose, Sparkles, Zap, Share2, Check, Loader2 } from 'lucide-react'
import Model3DWizard from './Model3DWizard'
import { ViewerToast } from './ViewerToast'

export function ViewerPageClient() {
  const loadingState = useViewerStore((s) => s.loadingState)
  const loadingProgress = useViewerStore((s) => s.loadingProgress)
  const loadingError = useViewerStore((s) => s.loadingError)
  const resetLoading = useViewerStore((s) => s.resetLoading)
  const isDrawingMode = useViewerStore((s) => s.isDrawingMode)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [draggingOverCanvas, setDraggingOverCanvas] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shared, setShared] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const t = useTranslations('Viewer')

  const handleFile = useCallback((file: File) => {
    setCurrentFile(file)
    setGenerationId(null)
    setShared(false)
  }, [])

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  }, [])

  const refreshCredits = useCallback(async () => {
    if (!userId) return

    try {
      const response = await fetch('/api/credits')
      if (!response.ok) return
      const data = (await response.json()) as { credits?: number }
      if (typeof data.credits === 'number') {
        setCredits(data.credits)
      }
    } catch {
      // Ignore transient credit refresh failures in the viewer UI.
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return

    let cancelled = false

    void (async () => {
      try {
        const response = await fetch('/api/credits')
        if (!response.ok) return
        const data = (await response.json()) as { credits?: number }
        if (!cancelled && typeof data.credits === 'number') {
          setCredits(data.credits)
        }
      } catch {
        // Ignore transient credit refresh failures in the viewer UI.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId])

  const handleOpenWizard = useCallback(() => {
    if (!userId) {
      window.location.href = '/login'
      return
    }
    setWizardOpen(true)
  }, [userId])

  const handleScreenshot = useCallback(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return

    const dataUrl = canvas.toDataURL('image/png')

    const state = useViewerStore.getState()
    const rawName = state.modelInfo?.fileName ?? 'model'
    const modelName = rawName.replace(/\.[^.]+$/, '')
    const viewName = state.viewport.currentView
    const date = new Date().toISOString().slice(0, 10)

    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${modelName}_${viewName}_${date}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [])

  const handleShare = useCallback(async () => {
    if (!generationId || sharing) return
    setSharing(true)
    try {
      const response = await fetch('/api/model3d/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationId }),
      })
      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error ?? t('shareFailed'))
      }
      const data = (await response.json()) as { shareUrl: string }
      const fullUrl = `${window.location.origin}${data.shareUrl}`
      await navigator.clipboard.writeText(fullUrl)
      setShared(true)
      useViewerStore.getState().showToast(t('shareLinkCopied'), 'info')
      setTimeout(() => setShared(false), 3000)
    } catch (err) {
      console.error('Share failed:', err)
      useViewerStore.getState().showToast(
        err instanceof Error ? err.message : t('shareFailed'),
      )
    } finally {
      setSharing(false)
    }
  }, [generationId, sharing, t])

  // Keyboard shortcuts
  useEffect(() => {
    const VIEW_KEYS: Record<string, ViewPreset> = {
      '1': 'iso', '2': 'front', '3': 'back', '4': 'left',
      '5': 'right', '6': 'top', '7': 'bottom', '0': 'free',
    }

    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const key = e.key

      // Drawing mode keyboard shortcuts
      if (useViewerStore.getState().isDrawingMode) {
        const drawingAlgoKeys: Record<string, DrawingAlgorithm> = {
          '1': 'edges', '2': 'sobel', '3': 'conditional', '4': 'projection', '5': 'outlines',
        }
        if (key in drawingAlgoKeys) {
          useViewerStore.getState().setActiveAlgorithm(drawingAlgoKeys[key])
          return
        }
        if (key === 'd' || key === 'D') {
          useViewerStore.getState().setDrawingMode(false)
          return
        }
        if (key === 'Escape') {
          useViewerStore.getState().setDrawingMode(false)
          return
        }
        if (key === 'h' || key === 'H') {
          useViewerStore.getState().toggleHiddenLines()
          return
        }
        const viewKeys: Record<string, ViewPreset> = {
          f: 'front', b: 'back', l: 'left', r: 'right',
          t: 'top', u: 'bottom', i: 'iso',
        }
        const lowerKey = key.toLowerCase()
        if (lowerKey in viewKeys) {
          useViewerStore.getState().setView(viewKeys[lowerKey])
          return
        }
        if (key === 'p' || key === 'P') {
          handleScreenshot()
          return
        }
        return // Block other 3D shortcuts in drawing mode
      }

      if (key === 'm' || key === 'M') {
        useViewerStore.getState().toggleMeasureMode()
        return
      }
      if (key === 'Escape') {
        if (useViewerStore.getState().measureMode) {
          useViewerStore.getState().toggleMeasureMode()
        }
        return
      }
      if (key === 'f' || key === 'F') {
        useViewerStore.getState().requestFit()
        return
      }
      if (key === 'p' || key === 'P') {
        handleScreenshot()
        return
      }
      if (key === 'w' || key === 'W') {
        useViewerStore.getState().toggleDisplayMode()
        return
      }
      if (key === 'd' || key === 'D') {
        useViewerStore.getState().setDrawingMode(true)
        return
      }
      if (key in VIEW_KEYS) {
        useViewerStore.getState().setView(VIEW_KEYS[key])
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleScreenshot])

  const handleCanvasDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setDraggingOverCanvas(false)
      const file = e.dataTransfer.files[0]
      if (!file) return
      if (!isSupportedFormat(file.name)) {
        useViewerStore.getState().showToast(t(LABELS.unsupportedFormat))
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        useViewerStore.getState().showToast(t(LABELS.fileTooLarge))
        return
      }
      if (file.size > WARN_FILE_SIZE) {
        useViewerStore.getState().showToast(t(LABELS.fileWarning), 'warning')
      }
      handleFile(file)
    },
    [handleFile, t],
  )

  const hasModel = loadingState === 'loaded' || loadingState === 'loading'

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-xl shadow-zinc-200/40">
      <div className="flex flex-col gap-4 border-b border-zinc-200/80 bg-white/90 px-4 py-3 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 rounded-2xl border border-zinc-200/60 bg-zinc-50/50 transition-colors hover:bg-zinc-50">
          <ViewerToolbar onFile={handleFile} onScreenshot={handleScreenshot} />
        </div>

        <div className="flex items-center gap-3">
          {userId && credits !== null && (
            <span className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-600 shadow-sm">
              <Zap className="h-4 w-4 text-amber-500" />
              {credits}
            </span>
          )}
          {generationId && loadingState === 'loaded' && (
            <button
              type="button"
              onClick={() => void handleShare()}
              disabled={sharing}
              className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-zinc-900/10 disabled:opacity-50"
            >
              {sharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : shared ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              {shared ? t('shareLinkCopied') : t('share3D')}
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenWizard}
            className="group flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-zinc-800 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-zinc-900/20"
          >
            <Sparkles className="h-4 w-4 transition-transform group-hover:scale-110" />
            {userId ? t('generate3D') : t('loginToGenerate')}
          </button>
        </div>
      </div>
      {isDrawingMode && loadingState === 'loaded' && <DrawingAlgorithmBar />}
      <div className="flex-1 relative overflow-hidden">
        <ViewerToast />
        {hasModel || currentFile ? (
          <div
            className="w-full h-full relative"
            onDragOver={(e) => { e.preventDefault(); setDraggingOverCanvas(true) }}
            onDragLeave={() => setDraggingOverCanvas(false)}
            onDrop={handleCanvasDrop}
          >
            <ViewerCanvas file={currentFile} />
            {draggingOverCanvas && (
              <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400 rounded-xl flex items-center justify-center pointer-events-none z-10">
                <p className="text-blue-600 font-medium text-lg">{t(LABELS.dropHint)}</p>
              </div>
            )}
            {loadingState === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-900 border-t-transparent" />
                <p className="mt-2 text-sm text-zinc-600">{currentFile?.name}</p>
                <p className="text-xs text-zinc-400">{loadingProgress}%</p>
              </div>
            )}
            {loadingState === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm z-10">
                <p className="text-sm text-red-600">{loadingError ?? t(LABELS.loadFailed)}</p>
                <button
                  type="button"
                  className="mt-3 px-4 py-1.5 text-sm rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
                  onClick={() => { resetLoading(); setCurrentFile(null) }}
                >
                  {t('reupload')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <DropZone onFile={handleFile} />
        )}

        {/* Sidebar: overlay panel, toggle button always visible */}
        {loadingState === 'loaded' && (
          <>
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="absolute top-2 right-2 z-30 p-2 rounded-lg bg-white/90 border border-zinc-200 shadow-md hover:bg-zinc-50 transition-colors"
              title={sidebarOpen ? t('collapseSidebar') : t('expandSidebar')}
            >
              {sidebarOpen ? <PanelRightClose className="w-5 h-5 text-zinc-600" /> : <PanelRightOpen className="w-5 h-5 text-zinc-600" />}
            </button>
            {sidebarOpen && (
              <>
                {/* Backdrop on small screens */}
                <div
                  className="absolute inset-0 z-20 bg-black/10 lg:hidden"
                  onClick={() => setSidebarOpen(false)}
                />
                <div className="absolute top-0 right-0 bottom-0 z-20 shadow-xl max-h-full">
                  {isDrawingMode ? <DrawingSidebar /> : <ViewerSidebar />}
                </div>
              </>
            )}
          </>
        )}
      </div>
      {loadingState === 'loaded' && (isDrawingMode ? <DrawingStatusBar /> : <ViewerStatusBar />)}
      {wizardOpen && userId && (
        <Model3DWizard
          userCredits={credits ?? 0}
          onClose={() => setWizardOpen(false)}
          onCreditsChange={setCredits}
          onRefreshCredits={refreshCredits}
          onModelLoaded={(file, genId) => {
            setWizardOpen(false)
            setCurrentFile(file)
            setShared(false)
            if (genId) setGenerationId(genId)
          }}
        />
      )}
    </div>
  )
}
