'use client'

import { useEffect, useState, useRef } from 'react'
import type { Object3D } from 'three'
import { BufferGeometry, BufferAttribute } from 'three'
import { useViewerStore } from '@/stores/useViewerStore'
import type { DrawingView } from '@/lib/viewer/viewRotations'
import type {
  ViewKey,
  ViewResult,
  LayoutResult,
  PostProcessOptions,
  Entity,
} from '@/lib/viewer/projection/types'
import {
  DEFAULT_POST_PROCESS_OPTIONS,
  DETAIL_PRESETS,
  float32ToSegments,
  computeBBox2D,
} from '@/lib/viewer/projection/types'
import { computeThreeViewLayout } from '@/lib/viewer/projection/threeViewLayout'
import { entitiesToGeometry } from '@/lib/viewer/projection/entityToGeometry'
import { initWorker, workerGenerate, nextModelId } from './useEdgeProjection'

// ─── Hook ───────────────────────────────────────────────────────────

export function useThreeViewProjection(model: Object3D | null): {
  layout: LayoutResult | null
  viewGeometries: Record<ViewKey, BufferGeometry> | null
  isComputing: boolean
} {
  const threeViewMode = useViewerStore((s) => s.threeViewMode)
  const angleThreshold = useViewerStore((s) => s.angleThreshold)
  const includeIntersectionEdges = useViewerStore((s) => s.showIntersectionEdges)
  const detailLevel = useViewerStore((s) => s.detailLevel)
  const cornerSensitivity = useViewerStore((s) => s.cornerSensitivity)
  const setProgress = useViewerStore((s) => s.setThreeViewProgress)

  const [layout, setLayout] = useState<LayoutResult | null>(null)
  const [viewGeometries, setViewGeometries] = useState<Record<ViewKey, BufferGeometry> | null>(null)
  const [isComputing, setIsComputing] = useState(false)

  const modelIdRef = useRef(0)

  // Assign a new model ID when the model changes
  useEffect(() => {
    if (model) {
      modelIdRef.current = nextModelId()
    }
  }, [model])

  useEffect(() => {
    if (!threeViewMode || !model) {
      setLayout(null)
      setViewGeometries(prev => {
        if (prev) Object.values(prev).forEach(g => g.dispose())
        return null
      })
      return
    }

    let cancelled = false
    setIsComputing(true)
    setProgress(0)

    // Build PostProcessOptions from presets
    const postProcessOptions: PostProcessOptions = {
      ...DEFAULT_POST_PROCESS_OPTIONS,
      ...DETAIL_PRESETS[detailLevel],
      cornerAngleDeg: cornerSensitivity,
    }

    async function generateThreeViews() {
      await initWorker(model!, modelIdRef.current)

      const views: ViewKey[] = ['front', 'left', 'top']
      const results: Partial<Record<ViewKey, { entities: Entity[]; rawSegments: Float32Array }>> = {}

      for (let i = 0; i < views.length; i++) {
        if (cancelled) return
        const viewKey = views[i]

        setProgress(i / 3)

        const result = await workerGenerate(
          viewKey as DrawingView,
          angleThreshold,
          (p) => setProgress((i + p) / 3),
          includeIntersectionEdges,
          true, // enablePostProcess
          postProcessOptions,
        )

        results[viewKey] = {
          entities: result.entities ?? [],
          rawSegments: result.visible.attributes.position.array as Float32Array,
        }
      }

      if (cancelled) return

      // Build ViewResults with bboxes
      const viewResults = {} as Record<ViewKey, ViewResult>
      for (const key of views) {
        const r = results[key]!
        const segs = float32ToSegments(r.rawSegments)
        const allPts = segs.flatMap((s) => [s.p1, s.p2])
        const bbox =
          allPts.length > 0
            ? computeBBox2D(allPts)
            : { min: { x: 0, y: 0 }, max: { x: 0, y: 0 }, width: 0, height: 0 }
        viewResults[key] = {
          viewKey: key,
          entities: r.entities,
          rawSegments: r.rawSegments,
          bbox,
        }
      }

      const layoutResult = computeThreeViewLayout(
        viewResults.front,
        viewResults.left,
        viewResults.top,
      )

      // Convert to geometries for rendering
      // If entities exist (post-processing succeeded), use them; otherwise fall back to raw segments
      function viewToGeometry(vr: ViewResult): BufferGeometry {
        if (vr.entities.length > 0) {
          return entitiesToGeometry(vr.entities)
        }
        // Fallback: render raw line segments directly
        const geom = new BufferGeometry()
        geom.setAttribute('position', new BufferAttribute(vr.rawSegments, 3))
        return geom
      }

      const geoms: Record<ViewKey, BufferGeometry> = {
        front: viewToGeometry(viewResults.front),
        left: viewToGeometry(viewResults.left),
        top: viewToGeometry(viewResults.top),
      }

      if (!cancelled) {
        setLayout(layoutResult)
        setViewGeometries(prev => {
          if (prev) Object.values(prev).forEach(g => g.dispose())
          return geoms
        })
        setIsComputing(false)
        setProgress(1)
      }
    }

    generateThreeViews().catch((err) => {
      if (!cancelled) {
        console.error('Three-view generation failed:', err)
        setIsComputing(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [threeViewMode, model, angleThreshold, includeIntersectionEdges, detailLevel, cornerSensitivity, setProgress])

  // Dispose geometries on unmount
  useEffect(() => {
    return () => {
      setViewGeometries(prev => {
        if (prev) Object.values(prev).forEach(g => g.dispose())
        return null
      })
    }
  }, [])

  return { layout, viewGeometries, isComputing }
}
