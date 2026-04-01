import { useMemo, useEffect } from 'react'
import {
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  EdgesGeometry,
} from 'three'
import type { Object3D, Mesh } from 'three'
import { buildConditionalEdges } from '@/lib/viewer/halfEdge'
import { useViewerStore } from '@/stores/useViewerStore'
import { conditionalLineVertexShader } from '../shaders/conditionalLineShader'

interface ConditionalLineData {
  conditionalGeometry: BufferGeometry
  featureGeometry: EdgesGeometry
  material: ShaderMaterial
}

export function useConditionalLines(model: Object3D | null) {
  const angleThreshold = useViewerStore((s) => s.angleThreshold)

  const { data, stats } = useMemo(() => {
    if (!model) return { data: [], stats: { computeTime: 0, totalConditional: 0, totalFeature: 0 } }

    const start = performance.now()
    const results: ConditionalLineData[] = []
    let totalConditional = 0
    let totalFeature = 0

    model.traverse((child) => {
      if (!(child as Mesh).isMesh) return
      const mesh = child as Mesh

      const { conditionalEdges, geometry: indexedGeo } = buildConditionalEdges(mesh.geometry)
      if (conditionalEdges.length === 0) return

      const positions = indexedGeo.attributes.position.array as Float32Array

      const linePositions: number[] = []
      const control0s: number[] = []
      const control1s: number[] = []

      for (const edge of conditionalEdges) {
        // Vertex A
        linePositions.push(positions[edge.a * 3], positions[edge.a * 3 + 1], positions[edge.a * 3 + 2])
        control0s.push(positions[edge.c0 * 3], positions[edge.c0 * 3 + 1], positions[edge.c0 * 3 + 2])
        control1s.push(positions[edge.c1 * 3], positions[edge.c1 * 3 + 1], positions[edge.c1 * 3 + 2])

        // Vertex B
        linePositions.push(positions[edge.b * 3], positions[edge.b * 3 + 1], positions[edge.b * 3 + 2])
        control0s.push(positions[edge.c0 * 3], positions[edge.c0 * 3 + 1], positions[edge.c0 * 3 + 2])
        control1s.push(positions[edge.c1 * 3], positions[edge.c1 * 3 + 1], positions[edge.c1 * 3 + 2])
      }

      const condGeo = new BufferGeometry()
      condGeo.setAttribute('position', new Float32BufferAttribute(linePositions, 3))
      condGeo.setAttribute('control0', new Float32BufferAttribute(control0s, 3))
      condGeo.setAttribute('control1', new Float32BufferAttribute(control1s, 3))

      totalConditional += conditionalEdges.length

      const featureGeo = new EdgesGeometry(indexedGeo, angleThreshold)
      totalFeature += (featureGeo.attributes.position?.count ?? 0) / 2

      const mat = new ShaderMaterial({
        vertexShader: conditionalLineVertexShader,
        fragmentShader: `void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }`,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })

      results.push({
        conditionalGeometry: condGeo,
        featureGeometry: featureGeo,
        material: mat,
      })
    })

    const computeTime = performance.now() - start
    return {
      data: results,
      stats: { computeTime, totalConditional, totalFeature },
    }
  }, [model, angleThreshold])

  // Update store stats (separate from useMemo)
  useEffect(() => {
    useViewerStore.getState().setDrawingStats({
      computeTime: stats.computeTime,
      lineCount: stats.totalConditional + stats.totalFeature,
      visibleLineCount: stats.totalConditional + stats.totalFeature,
      hiddenLineCount: 0,
    })
  }, [stats])

  // Cleanup
  useEffect(() => {
    return () => {
      data.forEach((d) => {
        d.conditionalGeometry.dispose()
        d.featureGeometry.dispose()
        d.material.dispose()
      })
    }
  }, [data])

  return data
}
