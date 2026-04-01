'use client'

import { useCallback, useState, type DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { isSupportedFormat, getExtension } from '@/lib/viewer/loaders'
import { MAX_FILE_SIZE, WARN_FILE_SIZE, LABELS } from '@/lib/viewer/constants'
import { useViewerStore } from '@/stores/useViewerStore'

interface DropZoneProps {
  onFile: (file: File) => void
}

export function DropZone({ onFile }: DropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const showToast = useViewerStore((s) => s.showToast)
  const t = useTranslations('Viewer')

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (!file) return
      if (!isSupportedFormat(file.name)) {
        showToast(t(LABELS.unsupportedFormat))
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        showToast(t(LABELS.fileTooLarge))
        return
      }
      if (file.size > WARN_FILE_SIZE) {
        showToast(t(LABELS.fileWarning), 'warning')
      }
      onFile(file)
    },
    [onFile, showToast, t],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!isSupportedFormat(file.name)) {
        showToast(t(LABELS.unsupportedFormat))
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        showToast(t(LABELS.fileTooLarge))
        return
      }
      onFile(file)
    },
    [onFile, showToast, t],
  )

  return (
    <div
      className={`relative w-full h-full p-6 transition-all duration-300 ${
        dragging ? 'bg-blue-50/80' : 'bg-transparent'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <div className={`flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-[2rem] transition-all duration-300 ${
        dragging
          ? 'border-blue-400 bg-white/50 scale-[0.98]'
          : 'border-zinc-300/80 hover:border-zinc-400 hover:bg-zinc-50/50'
      }`}>
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-blue-100/50 blur-xl rounded-full scale-150" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-sm border border-zinc-100">
            <Upload className={`w-10 h-10 transition-colors duration-300 ${dragging ? 'text-blue-500' : 'text-zinc-400'}`} />
          </div>
        </div>

        <h3 className="text-xl font-bold tracking-tight text-zinc-800 mb-2">
          {t(LABELS.dropHint)}
        </h3>
        <p className="text-sm text-zinc-500 mb-8 max-w-sm text-center">
          {t(LABELS.dropSubHint)}
        </p>

        <label className="group relative inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-8 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-zinc-800 hover:shadow-lg focus-within:ring-4 focus-within:ring-zinc-900/20 active:scale-95">
          <Upload className="w-4 h-4" />
          {t(LABELS.upload)}
          <input
            type="file"
            className="hidden pointer-events-none"
            accept=".glb,.gltf,.fbx,.obj,.stl"
            onChange={handleFileInput}
          />
        </label>
      </div>
    </div>
  )
}
