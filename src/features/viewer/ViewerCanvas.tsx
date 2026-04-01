'use client'

import dynamic from 'next/dynamic'
import { useViewerStore } from '@/stores/useViewerStore'

const ViewerCanvasInner = dynamic(
  () => import('./ViewerCanvasInner').then((mod) => mod.ViewerCanvasInner),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-zinc-50">
        <div className="animate-pulse text-zinc-400">加载 3D 引擎...</div>
      </div>
    ),
  },
)

const DrawingCanvas = dynamic(
  () => import('./drawing/DrawingCanvas').then((mod) => mod.DrawingCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <div className="animate-pulse text-zinc-400">加载绘图引擎...</div>
      </div>
    ),
  },
)

interface ViewerCanvasProps {
  file: File | null
}

export function ViewerCanvas({ file }: ViewerCanvasProps) {
  const isDrawingMode = useViewerStore((s) => s.isDrawingMode)

  if (isDrawingMode) {
    return <DrawingCanvas />
  }

  return <ViewerCanvasInner file={file} />
}
