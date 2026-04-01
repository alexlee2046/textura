import { useCallback } from 'react'
import { useViewerStore } from '@/stores/useViewerStore'
import { getProjectionCacheEntry } from './useEdgeProjection'
import { exportDXF as dxfExportFn } from '@/lib/viewer/dxfExport'
import { exportEnhancedDXF } from '@/lib/viewer/projection/enhancedDxfExport'
import { exportSVG } from '@/lib/viewer/projection/svgExport'
import { getGLContext } from '@/lib/viewer/glContext'
import { projectEdgesToLines } from '@/lib/viewer/edgeProjection'
import { captureHighRes } from '@/lib/viewer/highResCapture'
import { exportCompositeDXF as compositeExport } from '@/lib/viewer/compositeDxfExport'
import type { OrthographicCamera } from 'three'

function getModelName(): string {
  const raw = useViewerStore.getState().modelInfo?.fileName ?? 'model'
  return raw.replace(/\.[^.]+$/, '')
}

function getExportContext() {
  const state = useViewerStore.getState()
  if (state.activeAlgorithm !== 'projection') return null
  const viewKey = state.viewport.currentView === 'free' ? 'iso' : state.viewport.currentView
  const entry = getProjectionCacheEntry(viewKey, state.angleThreshold, state.showIntersectionEdges)
  return entry ? { entry, viewKey, modelName: getModelName() } : null
}

export function useDrawingExport() {
  const exportPNG = useCallback(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return

    const dataUrl = canvas.toDataURL('image/png')
    const state = useViewerStore.getState()
    const modelName = getModelName()
    const view = state.viewport.currentView
    const algo = state.activeAlgorithm
    const date = new Date().toISOString().slice(0, 10)

    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${modelName}_${algo}_${view}_${date}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [])

  const exportPDF = useCallback(async () => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return

    const { jsPDF } = await import('jspdf')
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height],
    })
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)

    const state = useViewerStore.getState()
    const modelName = getModelName()
    pdf.save(`${modelName}_${state.activeAlgorithm}_${state.viewport.currentView}.pdf`)
  }, [])

  const exportDXFFile = useCallback(async () => {
    const ctx = getExportContext()
    if (!ctx) return
    await dxfExportFn(ctx.entry.visible, ctx.entry.hidden, `${ctx.modelName}_${ctx.viewKey}`)
  }, [])

  const exportEnhancedDXFFile = useCallback(() => {
    const ctx = getExportContext()
    if (!ctx?.entry.entities) return
    exportEnhancedDXF(ctx.entry.entities, { fileName: `${ctx.modelName}_${ctx.viewKey}_enhanced` })
  }, [])

  const exportSVGFile = useCallback(() => {
    const ctx = getExportContext()
    if (!ctx?.entry.entities) return
    exportSVG(ctx.entry.entities, { fileName: `${ctx.modelName}_${ctx.viewKey}` })
  }, [])

  const exportVectorizedDXF = useCallback(async () => {
    const { gl, scene, camera } = getGLContext()
    const state = useViewerStore.getState()
    if (!gl || !scene || !camera || !state.loadedModel) return

    const modelName = getModelName()

    // Part 1: Geometric projection of feature edges -> LINE entities
    const edgeLines = projectEdgesToLines(
      state.loadedModel,
      camera as OrthographicCamera,
      state.angleThreshold,
    )

    // Part 2: High-res capture -> Potrace -> SVG outlines
    // Compute capture dimensions from camera aspect ratio to avoid distortion
    const ortho = camera as OrthographicCamera
    const aspect = (ortho.right - ortho.left) / (ortho.top - ortho.bottom)
    const captureW = 4096
    const captureH = Math.round(captureW / Math.abs(aspect))

    let outlineSvg: string | null = null
    try {
      const blob = await captureHighRes(gl, scene, camera, captureW, captureH)
      const formData = new FormData()
      formData.append('image', blob, 'capture.png')
      formData.append('format', 'svg')

      const res = await fetch('/api/orthographic/export', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        outlineSvg = await res.text()
      }
    } catch (e) {
      console.warn('Outline vectorization failed, exporting edges only:', e)
    }

    // Part 3: Merge into composite DXF
    compositeExport(edgeLines, outlineSvg, `${modelName}_composite`)
  }, [])

  return { exportPNG, exportPDF, exportDXFFile, exportEnhancedDXFFile, exportSVGFile, exportVectorizedDXF }
}
