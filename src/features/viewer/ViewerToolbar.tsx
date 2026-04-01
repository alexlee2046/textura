'use client'

import { Upload, X, Camera, Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useViewerStore } from '@/stores/useViewerStore'
import { LABELS } from '@/lib/viewer/constants'
import { isSupportedFormat } from '@/lib/viewer/loaders'
import { MAX_FILE_SIZE } from '@/lib/viewer/constants'

interface ViewerToolbarProps {
  onFile: (file: File) => void
  onScreenshot: () => void
}

export function ViewerToolbar({ onFile, onScreenshot }: ViewerToolbarProps) {
  const modelInfo = useViewerStore((s) => s.modelInfo)
  const clearModel = useViewerStore((s) => s.clearModel)
  const loadingState = useViewerStore((s) => s.loadingState)
  const isDrawingMode = useViewerStore((s) => s.isDrawingMode)

  const showToast = useViewerStore((s) => s.showToast)
  const t = useTranslations('Viewer')

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!isSupportedFormat(file.name)) { showToast(t(LABELS.unsupportedFormat)); return }
    if (file.size > MAX_FILE_SIZE) { showToast(t(LABELS.fileTooLarge)); return }
    onFile(file)
    e.target.value = '' // Reset for same file re-upload
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {modelInfo && (
          <>
            <button
              type="button"
              onClick={() => useViewerStore.getState().setDrawingMode(!useViewerStore.getState().isDrawingMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                isDrawingMode
                  ? 'bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800'
                  : 'border-zinc-200 hover:bg-zinc-50'
              }`}
              title="D"
            >
              <Pencil className="w-4 h-4" />
              {t('drawingMode')}
            </button>
            <button
              type="button"
              onClick={onScreenshot}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
              title="P"
            >
              <Camera className="w-4 h-4" />
              {t(LABELS.screenshot)}
            </button>
            <button
              type="button"
              onClick={clearModel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors text-red-600"
            >
              <X className="w-4 h-4" />
              {t(LABELS.close)}
            </button>
          </>
        )}
        <label className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-zinc-900 text-white cursor-pointer hover:bg-zinc-800 transition-colors">
          <Upload className="w-4 h-4" />
          {t(LABELS.upload)}
          <input
            type="file"
            className="hidden"
            accept=".glb,.gltf,.fbx,.obj,.stl"
            onChange={handleFileInput}
            disabled={loadingState === 'loading'}
          />
        </label>
      </div>
    </div>
  )
}
