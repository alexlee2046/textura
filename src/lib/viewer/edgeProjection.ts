import {
  EdgesGeometry,
  Matrix4,
  Vector4,
} from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Object3D, Mesh, OrthographicCamera } from 'three'

export interface Line2D {
  from: [number, number]
  to: [number, number]
}

/**
 * Extract visible feature edges from a 3D model and project them to 2D.
 *
 * Uses EdgesGeometry to find edges where adjacent face normals differ by more
 * than `angleThreshold` degrees, then projects through the camera's VP matrix.
 *
 * Depth testing: renders a depth pass to determine which edges are visible.
 * For simplicity in v1, we skip depth testing — all feature edges are projected.
 * The WhiteModelBase in CompositeAlgorithm handles visual occlusion for preview.
 * For DXF export, unoccluded feature edges are acceptable for most furniture models.
 */
export function projectEdgesToLines(
  model: Object3D,
  camera: OrthographicCamera,
  angleThreshold: number,
): Line2D[] {
  const lines: Line2D[] = []

  // Build view-projection matrix
  camera.updateMatrixWorld(true)
  const vpMatrix = new Matrix4()
    .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)

  const v1 = new Vector4()
  const v2 = new Vector4()

  model.updateMatrixWorld(true)

  model.traverse((child) => {
    if (!(child as Mesh).isMesh) return
    const mesh = child as Mesh

    // EdgesGeometry needs indexed geometry to detect shared edges correctly.
    // Non-indexed geometry (common in glTF) has no shared vertices, so
    // mergeVertices builds the index first — same pattern as useEdgesGeometry.
    let geo = mesh.geometry
    if (!geo.index) {
      geo = mergeVertices(geo)
    }

    // Create EdgesGeometry with angle threshold (degrees)
    const edges = new EdgesGeometry(geo, angleThreshold)
    const positions = edges.getAttribute('position')
    if (!positions) { edges.dispose(); return }

    // Build model→NDC matrix: VP × MeshWorldMatrix
    const mvp = new Matrix4().multiplyMatrices(vpMatrix, mesh.matrixWorld)

    for (let i = 0; i < positions.count; i += 2) {
      // Project start point
      v1.set(positions.getX(i), positions.getY(i), positions.getZ(i), 1)
      v1.applyMatrix4(mvp)
      if (v1.w !== 0) { v1.x /= v1.w; v1.y /= v1.w }

      // Project end point
      v2.set(positions.getX(i + 1), positions.getY(i + 1), positions.getZ(i + 1), 1)
      v2.applyMatrix4(mvp)
      if (v2.w !== 0) { v2.x /= v2.w; v2.y /= v2.w }

      // NDC coords are in [-1, 1], kept as-is for DXF export
      lines.push({
        from: [v1.x, v1.y],
        to: [v2.x, v2.y],
      })
    }

    edges.dispose()
  })

  return lines
}
