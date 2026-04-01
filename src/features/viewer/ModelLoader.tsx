import { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { useViewerStore } from '@/stores/useViewerStore'
import { loadModel, getExtension } from '@/lib/viewer/loaders'
import {
  computeBBox,
  isBBoxValid,
  isBBoxEmpty,
  isBBoxAbnormal,
  centerModel,
  needsUpAxisCorrection,
  applyUpAxisCorrection,
  extractModelInfo,
} from '@/lib/viewer/modelProcessing'
import { disposeModel } from '@/lib/viewer/disposeModel'
import { LABELS } from '@/lib/viewer/constants'
import { DoubleSide, Mesh, type Object3D, type MeshStandardMaterial } from 'three'

interface ModelLoaderProps {
  file: File | null
}

export function ModelLoader({ file }: ModelLoaderProps) {
  const { invalidate } = useThree()
  const [model, setLocalModel] = useState<Object3D | null>(null)
  const setLoading = useViewerStore((s) => s.setLoading)
  const setLoaded = useViewerStore((s) => s.setLoaded)
  const setLoadError = useViewerStore((s) => s.setLoadError)
  const setModel = useViewerStore((s) => s.setModel)
  const displayMode = useViewerStore((s) => s.displayMode)

  // Load model when file changes
  useEffect(() => {
    if (!file) return

    let cancelled = false
    const url = URL.createObjectURL(file)
    const ext = getExtension(file.name) // Hoisted above try for catch access

    // Dispose previous model first (before loading new one)
    if (model) {
      disposeModel(model)
      setLocalModel(null)
    }

    setLoading(0)

    async function load() {
      try {
        const loaded = await loadModel(url, file!.name, (progress) => {
          if (!cancelled) setLoading(progress)
        })

        if (cancelled) { disposeModel(loaded); return }

        // Set DoubleSide on all materials for reliable raycasting
        loaded.traverse((child) => {
          if ((child as Mesh).isMesh) {
            const mesh = child as Mesh
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
            mats.forEach((mat) => { mat.side = DoubleSide })
          }
        })

        // Up-axis correction for OBJ/STL
        const preBbox = computeBBox(loaded)
        if (needsUpAxisCorrection(preBbox.size, ext)) {
          applyUpAxisCorrection(loaded)
        }

        // Compute bounding box after corrections
        const bbox = computeBBox(loaded)

        if (!isBBoxValid(bbox)) {
          setLoadError(LABELS.corruptData)
          disposeModel(loaded)
          return
        }

        if (isBBoxEmpty(bbox)) {
          setLoadError(LABELS.emptyModel)
          disposeModel(loaded)
          return
        }

        if (isBBoxAbnormal(bbox)) {
          console.warn(LABELS.abnormalSize)
          // TODO: show scale selection UI (0.1x/1x/10x/100x)
        }

        // Center model
        centerModel(loaded, bbox.center)

        // Re-compute bbox after centering
        const finalBbox = computeBBox(loaded)
        const info = extractModelInfo(loaded, finalBbox)

        // Store model via React state -> renders as <primitive> inside <Bvh>
        setLocalModel(loaded)
        setModel(loaded, finalBbox.box, {
          fileName: file!.name,
          ...info,
        })
        setLoaded()
        invalidate()
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('Model load failed:', err)
          if (ext === 'gltf') {
            setLoadError(`${LABELS.loadFailed}: ${message}\n${LABELS.gltfHint}`)
          } else {
            setLoadError(`${LABELS.loadFailed}: ${message}`)
          }
        }
      } finally {
        URL.revokeObjectURL(url)
      }
    }

    load()
    return () => { cancelled = true }
  }, [file]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply wireframe display mode
  useEffect(() => {
    if (!model) return
    model.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        mats.forEach((mat) => { (mat as MeshStandardMaterial).wireframe = displayMode === 'wireframe' })
      }
    })
    invalidate()
  }, [displayMode, model, invalidate])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (model) disposeModel(model)
    }
  }, [model])

  // Render model declaratively inside <Bvh> -- this is how BVH patching works
  if (!model) return null
  return <primitive object={model} />
}
