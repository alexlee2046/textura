import { useCallback, useEffect, useRef } from 'react'
import type { Object3D, Mesh as ThreeMesh } from 'three'
import { BufferGeometry, BufferAttribute } from 'three'
import { useViewerStore } from '@/stores/useViewerStore'
import { VIEW_ROTATIONS, type DrawingView } from '@/lib/viewer/viewRotations'
import { preprocessMesh } from '@/lib/viewer/meshPreprocess'
import type { Entity } from '@/lib/viewer/projection/types'

// ─── Module-level state ─────────────────────────────────────────────

const projectionCache = new Map<string, { visible: BufferGeometry; hidden: BufferGeometry; entities?: Entity[] }>()
export let modelIdCounter = 0
export function nextModelId(): number { return ++modelIdCounter }

let worker: Worker | null = null
let workerModelId = -1
let workerInitPromise: Promise<void> | null = null
let precomputeCtrl: AbortController | null = null
let nextRequestId = 0

// Furniture-optimized order: front/side/top first (most used in engineering drawings)
const ALL_VIEWS: DrawingView[] = ['front', 'left', 'top', 'right', 'back', 'bottom', 'iso']

function getCacheKey(modelId: number, view: string, angle: number, intersection: boolean) {
  return `${modelId}_${view}_${angle}_${intersection ? 1 : 0}`
}

export function clearProjectionCache() {
  for (const entry of projectionCache.values()) {
    entry.visible.dispose()
    entry.hidden.dispose()
  }
  projectionCache.clear()
}

export function terminateProjectionWorker() {
  worker?.terminate()
  worker = null
  workerModelId = -1
  workerInitPromise = null
}

export function getProjectionCacheEntry(
  view: string,
  angle: number,
  intersection: boolean,
): { visible: BufferGeometry; hidden: BufferGeometry; entities?: Entity[] } | undefined {
  for (const [key, entry] of projectionCache) {
    if (key.endsWith(`_${view}_${angle}_${intersection ? 1 : 0}`)) return entry
  }
  return undefined
}

// ─── Worker management ──────────────────────────────────────────────

function ensureWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('./projection.worker.ts', import.meta.url),
    )
    worker.onerror = (e) => console.error('Projection worker error:', e)
  }
  return worker
}

export function initWorker(model: Object3D, modelId: number): Promise<void> {
  if (workerModelId === modelId && workerInitPromise) return workerInitPromise

  workerModelId = modelId
  workerInitPromise = new Promise<void>((resolve, reject) => {
    const w = ensureWorker()

    // Serialize all mesh geometries + world matrices
    const meshes: { position: Float32Array; index: ArrayLike<number> | null; matrix: number[] }[] = []
    const transfers: ArrayBuffer[] = []

    model.updateMatrixWorld(true)
    model.traverse((child) => {
      const m = child as ThreeMesh
      if (!m.isMesh) return
      const processed = preprocessMesh(m.geometry)
      const pos = (processed.attributes.position.array as Float32Array).slice()
      const idx = processed.index ? (processed.index.array as Uint32Array | Uint16Array).slice() : null
      meshes.push({ position: pos, index: idx, matrix: Array.from(m.matrixWorld.elements) })
      transfers.push(pos.buffer)
      if (idx) transfers.push(idx.buffer)
    })

    const onMsg = (e: MessageEvent) => {
      if (e.data.type === 'ready') {
        w.removeEventListener('message', onMsg)
        resolve()
      }
    }
    w.addEventListener('message', onMsg)
    w.postMessage({ type: 'init', meshes }, transfers)
  }).catch((err) => {
    workerInitPromise = null // allow retry
    throw err
  })

  return workerInitPromise
}

export function workerGenerate(
  viewKey: DrawingView,
  angleThreshold: number,
  onProgress?: (progress: number, phase: string) => void,
  includeIntersectionEdges = true,
  enablePostProcess = false,
  postProcessOptions?: object,
): Promise<{ visible: BufferGeometry; hidden: BufferGeometry; entities?: Entity[]; computeTime: number }> {
  const requestId = ++nextRequestId

  return new Promise((resolve, reject) => {
    const w = ensureWorker()
    const rotation = VIEW_ROTATIONS[viewKey]

    const onMsg = (e: MessageEvent) => {
      if (e.data.requestId !== requestId) return

      if (e.data.type === 'result') {
        w.removeEventListener('message', onMsg)
        const visGeom = new BufferGeometry()
        visGeom.setAttribute('position', new BufferAttribute(e.data.visible, 3))
        const hidGeom = new BufferGeometry()
        hidGeom.setAttribute('position', new BufferAttribute(e.data.hidden, 3))
        resolve({ visible: visGeom, hidden: hidGeom, entities: e.data.entities, computeTime: e.data.computeTime })
      } else if (e.data.type === 'error') {
        w.removeEventListener('message', onMsg)
        reject(new Error(e.data.message))
      } else if (e.data.type === 'progress' && onProgress) {
        onProgress(e.data.ratio, e.data.phase)
      }
    }
    w.addEventListener('message', onMsg)

    w.postMessage({
      type: 'generate',
      rotation: [rotation.x, rotation.y, rotation.z, rotation.order],
      angleThreshold,
      includeIntersectionEdges,
      enablePostProcess,
      postProcessOptions,
      viewKey,
      requestId,
    })
  })
}

// ─── Background pre-computation ─────────────────────────────────────

async function precomputeRemaining(
  modelId: number,
  angleThreshold: number,
  includeIntersectionEdges: boolean,
  doneView: string,
  signal: AbortSignal,
) {
  for (const view of ALL_VIEWS) {
    if (signal.aborted) return
    if (view === doneView) continue
    if (projectionCache.has(getCacheKey(modelId, view, angleThreshold, includeIntersectionEdges))) continue

    // Still relevant?
    const s = useViewerStore.getState()
    if (s.activeAlgorithm !== 'projection' || s.angleThreshold !== angleThreshold) return
    if (s.showIntersectionEdges !== includeIntersectionEdges) return

    try {
      const r = await workerGenerate(view, angleThreshold, undefined, includeIntersectionEdges)
      if (signal.aborted) return
      projectionCache.set(getCacheKey(modelId, view, angleThreshold, includeIntersectionEdges), {
        visible: r.visible,
        hidden: r.hidden,
      })
    } catch {
      // Ignore pre-computation errors
    }
  }
}

// ─── Main-thread fallback ───────────────────────────────────────────

async function mainThreadGenerate(
  model: Object3D,
  viewKey: DrawingView,
  angleThreshold: number,
  setProgress: (p: number, phase: string) => void,
  signal: AbortSignal,
): Promise<{ visible: BufferGeometry; hidden: BufferGeometry; computeTime: number }> {
  // Pre-build BVH on original geometry (shared with clone)
  const { MeshBVH } = await import('three-mesh-bvh')
  model.traverse((child) => {
    const m = child as ThreeMesh
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (m.isMesh && !(m.geometry as any).boundsTree) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(m.geometry as any).boundsTree = new MeshBVH(m.geometry)
    }
  })

  // @ts-expect-error - three-edge-projection has no type definitions
  const { ProjectionGenerator } = await import('three-edge-projection')

  const clone = model.clone(true)
  clone.rotation.copy(VIEW_ROTATIONS[viewKey])
  clone.updateMatrixWorld(true)

  const gen = new ProjectionGenerator()
  gen.angleThreshold = angleThreshold
  gen.includeIntersectionEdges = false
  gen.iterationTime = 100

  const start = performance.now()
  const task = gen.generate(clone, {
    onProgress: (phase: string, ratio?: number) => setProgress(ratio ?? 0, phase),
  })

  const result = await new Promise<ReturnType<typeof task.next>['value']>((resolve, reject) => {
    ;(function step() {
      if (signal.aborted) {
        reject(new Error('Aborted'))
        return
      }
      const r = task.next()
      r.done ? resolve(r.value) : setTimeout(step, 0)
    })()
  })

  return {
    visible: result.getVisibleLineGeometry(),
    hidden: result.getHiddenLineGeometry(),
    computeTime: performance.now() - start,
  }
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useEdgeProjection(model: Object3D | null) {
  const angleThreshold = useViewerStore((s) => s.angleThreshold)
  const currentView = useViewerStore((s) => s.viewport.currentView)
  const setProgress = useViewerStore((s) => s.setProjectionProgress)
  const setError = useViewerStore((s) => s.setProjectionError)
  const setStats = useViewerStore((s) => s.setDrawingStats)
  const includeIntersectionEdges = useViewerStore((s) => s.showIntersectionEdges)
  const modelIdRef = useRef(0)

  // Model change → new ID, clear cache, force worker re-init
  useEffect(() => {
    if (model) {
      modelIdRef.current = nextModelId()
      clearProjectionCache()
      workerInitPromise = null
    }
  }, [model])

  // Angle threshold or intersection toggle change → clear cache, abort pre-computation
  useEffect(() => {
    clearProjectionCache()
    precomputeCtrl?.abort()
  }, [angleThreshold, includeIntersectionEdges])

  const generate = useCallback(async (): Promise<{
    visible: BufferGeometry
    hidden: BufferGeometry
  } | null> => {
    if (!model) return null

    const viewKey = (currentView === 'free' ? 'iso' : currentView) as DrawingView
    if (!(viewKey in VIEW_ROTATIONS)) return null

    const modelId = modelIdRef.current
    const cacheKey = getCacheKey(modelId, viewKey, angleThreshold, includeIntersectionEdges)

    // ── Cache hit ──
    if (projectionCache.has(cacheKey)) {
      const cached = projectionCache.get(cacheKey)!
      const vc = (cached.visible.attributes.position?.count ?? 0) / 2
      const hc = (cached.hidden.attributes.position?.count ?? 0) / 2
      setStats({ computeTime: 0, lineCount: vc + hc, visibleLineCount: vc, hiddenLineCount: hc })
      return cached
    }

    // Abort previous pre-computation so the current view gets priority
    precomputeCtrl?.abort()

    useViewerStore.setState({ isProjecting: true, projectionError: null })

    let vis: BufferGeometry
    let hid: BufferGeometry
    let computeTime: number
    let entities: Entity[] | undefined

    try {
      // ── Worker path ──
      await initWorker(model, modelId)

      // Re-check cache (pre-computation might have filled it while awaiting init)
      if (projectionCache.has(cacheKey)) {
        useViewerStore.setState({ isProjecting: false })
        const cached = projectionCache.get(cacheKey)!
        const vc = (cached.visible.attributes.position?.count ?? 0) / 2
        const hc = (cached.hidden.attributes.position?.count ?? 0) / 2
        setStats({ computeTime: 0, lineCount: vc + hc, visibleLineCount: vc, hiddenLineCount: hc })
        return cached
      }

      const r = await workerGenerate(viewKey, angleThreshold, (p, phase) => setProgress(p, phase), includeIntersectionEdges)
      vis = r.visible
      hid = r.hidden
      computeTime = r.computeTime
      entities = r.entities
    } catch (workerErr) {
      // ── Fallback: main thread ──
      console.warn('Worker projection failed, falling back to main thread:', workerErr)
      try {
        const abort = new AbortController()
        const r = await mainThreadGenerate(model, viewKey, angleThreshold, setProgress, abort.signal)
        vis = r.visible
        hid = r.hidden
        computeTime = r.computeTime
      } catch (e2) {
        if (!(e2 instanceof Error) || !e2.message.includes('Abort')) {
          const msg = e2 instanceof Error ? e2.message : 'Projection failed'
          setError(msg)
          console.error('Edge projection error:', e2)
        }
        useViewerStore.setState({ isProjecting: false })
        return null
      }
    }

    // ── Cache + stats ──
    const entry = { visible: vis, hidden: hid, entities }
    projectionCache.set(cacheKey, entry)

    // Trim cache (14 = 2 full sets of views)
    while (projectionCache.size > 14) {
      const firstKey = projectionCache.keys().next().value
      if (!firstKey) break
      const old = projectionCache.get(firstKey)!
      old.visible.dispose()
      old.hidden.dispose()
      projectionCache.delete(firstKey)
    }

    const vc = (vis.attributes.position?.count ?? 0) / 2
    const hc = (hid.attributes.position?.count ?? 0) / 2
    setStats({ computeTime, lineCount: vc + hc, visibleLineCount: vc, hiddenLineCount: hc })

    useViewerStore.setState({ isProjecting: false })

    // ── Pre-compute remaining views in background ──
    precomputeCtrl = new AbortController()
    precomputeRemaining(modelId, angleThreshold, includeIntersectionEdges, viewKey, precomputeCtrl.signal)

    return entry
  }, [model, currentView, angleThreshold, includeIntersectionEdges, setProgress, setError, setStats])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      precomputeCtrl?.abort()
      clearProjectionCache()
    }
  }, [])

  return { generate }
}
