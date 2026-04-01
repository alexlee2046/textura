// @ts-nocheck — Worker global scope differs from DOM; skip type-checking this file.

import {
  BufferGeometry,
  BufferAttribute,
  Mesh,
  Group,
  Euler,
  Matrix4,
} from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { ProjectionGenerator } from 'three-edge-projection'
import { filterSegments } from '@/lib/viewer/projection/lineFilter'
import { buildChains } from '@/lib/viewer/projection/lineGraph'
import { fitChains } from '@/lib/viewer/projection/curveFit'
import { float32ToSegments, computeBBox2D } from '@/lib/viewer/projection/types'

let stored = [] // { geometry: BufferGeometry, matrix: Matrix4 }[]

self.onmessage = (e) => {
  const msg = e.data

  // ── init: receive serialized meshes, build BVH once ──
  if (msg.type === 'init') {
    for (const s of stored) s.geometry.dispose()

    stored = msg.meshes.map((m) => {
      const geom = new BufferGeometry()
      geom.setAttribute('position', new BufferAttribute(m.position, 3))
      if (m.index) geom.setIndex(new BufferAttribute(m.index, 1))

      // Pre-build BVH — ProjectedEdgeCollector reuses via geometry.boundsTree
      geom.boundsTree = new MeshBVH(geom)

      return { geometry: geom, matrix: new Matrix4().fromArray(m.matrix) }
    })

    self.postMessage({ type: 'ready' })
    return
  }

  // ── generate: run projection for one view ──
  if (msg.type === 'generate') {
    const start = performance.now()
    try {
      const scene = new Group()
      scene.rotation.copy(
        new Euler(msg.rotation[0], msg.rotation[1], msg.rotation[2], msg.rotation[3]),
      )

      for (const { geometry, matrix } of stored) {
        const mesh = new Mesh(geometry)
        mesh.matrixAutoUpdate = false
        mesh.matrix.copy(matrix)
        scene.add(mesh)
      }
      scene.updateMatrixWorld(true)

      const gen = new ProjectionGenerator()
      gen.angleThreshold = msg.angleThreshold
      gen.includeIntersectionEdges = msg.includeIntersectionEdges ?? false
      gen.iterationTime = Infinity // No yielding in worker thread

      const task = gen.generate(scene, {
        onProgress: (phase, ratio) => {
          self.postMessage({
            type: 'progress',
            phase,
            ratio: ratio ?? 0,
            requestId: msg.requestId,
          })
        },
      })

      let r = task.next()
      while (!r.done) r = task.next()

      const visGeom = r.value.getVisibleLineGeometry()
      const hidGeom = r.value.getHiddenLineGeometry()
      const visArr = visGeom.attributes.position.array
      const hidArr = hidGeom.attributes.position.array

      if (msg.enablePostProcess) {
        let entities = undefined
        try {
          const segments = float32ToSegments(visArr)
          if (segments.length > 0) {
            const allPts = segments.flatMap(s => [s.p1, s.p2])
            const bbox = computeBBox2D(allPts)
            const D = Math.sqrt(bbox.width ** 2 + bbox.height ** 2)
            if (D > 0 && isFinite(D)) {
              const opts = msg.postProcessOptions
              const filtered = filterSegments(segments, D, opts)
              const chains = buildChains(filtered, D, opts)
              entities = fitChains(chains, D, opts)
            }
          }
        } catch (ppErr) {
          console.warn('Post-processing failed, returning raw segments:', ppErr)
        }

        self.postMessage(
          {
            type: 'result',
            visible: visArr,
            hidden: hidArr,
            entities,
            requestId: msg.requestId,
            computeTime: performance.now() - start,
          },
          [visArr.buffer, hidArr.buffer],
        )
      } else {
        self.postMessage(
          {
            type: 'result',
            visible: visArr,
            hidden: hidArr,
            requestId: msg.requestId,
            computeTime: performance.now() - start,
          },
          [visArr.buffer, hidArr.buffer],
        )
      }

      scene.clear()
    } catch (err) {
      self.postMessage({
        type: 'error',
        message: err?.message ?? 'Projection failed',
        requestId: msg.requestId,
      })
    }
  }
}
