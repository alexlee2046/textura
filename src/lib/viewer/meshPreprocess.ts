// src/lib/viewer/meshPreprocess.ts
import { BufferGeometry, Vector3 } from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const AREA_THRESHOLD = 1e-10

export function preprocessMesh(geometry: BufferGeometry, tolerance = 1e-4): BufferGeometry {
  // 1. Vertex welding — eliminates T-junctions
  let merged = mergeVertices(geometry, tolerance)

  // 2. Remove degenerate triangles (area < threshold)
  const index = merged.index
  if (index) {
    const pos = merged.attributes.position
    const v0 = new Vector3(), v1 = new Vector3(), v2 = new Vector3()
    const edge1 = new Vector3(), edge2 = new Vector3(), cross = new Vector3()
    const newIndices: number[] = []

    for (let i = 0; i < index.count; i += 3) {
      const i0 = index.getX(i), i1 = index.getX(i + 1), i2 = index.getX(i + 2)
      v0.fromBufferAttribute(pos, i0)
      v1.fromBufferAttribute(pos, i1)
      v2.fromBufferAttribute(pos, i2)
      edge1.subVectors(v1, v0)
      edge2.subVectors(v2, v0)
      cross.crossVectors(edge1, edge2)
      if (cross.length() * 0.5 > AREA_THRESHOLD) {
        newIndices.push(i0, i1, i2)
      }
    }

    if (newIndices.length < index.count) {
      merged = merged.clone()
      merged.setIndex(newIndices)
    }
  }

  // 3. Recompute normals for correct angleThreshold behavior
  merged.computeVertexNormals()

  return merged
}
