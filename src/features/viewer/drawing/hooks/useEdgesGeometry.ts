import { useMemo, useEffect } from 'react'
import {
  EdgesGeometry,
  Mesh,
  Vector3,
  Quaternion,
  Euler,
} from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Object3D } from 'three'
import { useViewerStore } from '@/stores/useViewerStore'

export function useEdgesGeometry(model: Object3D | null) {
  const angleThreshold = useViewerStore((s) => s.angleThreshold)

  const { edgesData, stats } = useMemo(() => {
    if (!model) return { edgesData: [], stats: { computeTime: 0, lineCount: 0 } }

    const start = performance.now()
    const result: { geometry: EdgesGeometry; position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }[] = []
    let totalLines = 0

    const _v = new Vector3()
    const _q = new Quaternion()
    const _s = new Vector3()
    const _e = new Euler()

    model.traverse((child) => {
      if (!(child as Mesh).isMesh) return
      const mesh = child as Mesh

      let geo = mesh.geometry
      if (!geo.index) {
        geo = mergeVertices(geo)
      }

      const edges = new EdgesGeometry(geo, angleThreshold)
      const lineCount = edges.attributes.position
        ? edges.attributes.position.count / 2
        : 0
      totalLines += lineCount

      mesh.updateMatrixWorld(true)
      const wp = mesh.getWorldPosition(_v.clone())
      const wr = mesh.getWorldQuaternion(_q.clone())
      const ws = mesh.getWorldScale(_s.clone())
      const euler = _e.clone().setFromQuaternion(wr)

      result.push({
        geometry: edges,
        position: [wp.x, wp.y, wp.z],
        rotation: [euler.x, euler.y, euler.z],
        scale: [ws.x, ws.y, ws.z],
      })
    })

    const computeTime = performance.now() - start
    return { edgesData: result, stats: { computeTime, lineCount: totalLines } }
  }, [model, angleThreshold])

  useEffect(() => {
    useViewerStore.getState().setDrawingStats({
      computeTime: stats.computeTime,
      lineCount: stats.lineCount,
      visibleLineCount: stats.lineCount,
      hiddenLineCount: 0,
    })
  }, [stats])

  useEffect(() => {
    return () => {
      edgesData.forEach((d) => d.geometry.dispose())
    }
  }, [edgesData])

  return edgesData
}
