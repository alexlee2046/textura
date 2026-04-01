import { Box3, Vector3, Mesh, type Object3D } from 'three'

export interface BBoxResult {
  box: Box3
  center: Vector3
  size: Vector3
  maxDimension: number
}

/** Compute bounding box from Mesh children only (filters Camera/Light/Bone) */
export function computeBBox(scene: Object3D): BBoxResult {
  scene.updateMatrixWorld(true)

  const box = new Box3()
  scene.traverse((child) => {
    if ((child as Mesh).isMesh) {
      const mesh = child as Mesh
      if (mesh.geometry?.attributes?.position) {
        box.expandByObject(mesh)
      }
    }
  })

  const center = new Vector3()
  const size = new Vector3()
  box.getCenter(center)
  box.getSize(size)

  return { box, center, size, maxDimension: Math.max(size.x, size.y, size.z) }
}

/** Check if bounding box is valid (no NaN, no Infinity) */
export function isBBoxValid(bbox: BBoxResult): boolean {
  const { size } = bbox
  return (
    isFinite(size.x) && isFinite(size.y) && isFinite(size.z) &&
    !isNaN(size.x) && !isNaN(size.y) && !isNaN(size.z) &&
    bbox.maxDimension > 0
  )
}

/** Check if bounding box is empty (all dimensions zero) */
export function isBBoxEmpty(bbox: BBoxResult): boolean {
  return bbox.maxDimension === 0
}

/** Check if dimensions seem abnormally large (possible unit issue) */
export function isBBoxAbnormal(bbox: BBoxResult): boolean {
  return bbox.maxDimension > 10000 // > 10 meters in mm
}

/** Center model at origin */
export function centerModel(scene: Object3D, center: Vector3): void {
  scene.position.sub(center)
}

/** Heuristic up-axis correction for OBJ/STL (likely Z-up if Y is very flat) */
export function needsUpAxisCorrection(
  size: Vector3,
  ext: string,
): boolean {
  if (ext === 'glb' || ext === 'gltf' || ext === 'fbx') return false
  const maxXZ = Math.max(size.x, size.z)
  return maxXZ > 0 && size.y < maxXZ * 0.3
}

export function applyUpAxisCorrection(scene: Object3D): void {
  scene.rotation.x = -Math.PI / 2
  scene.updateMatrixWorld(true)
}

/** Apply manual 90-degree rotation around an axis */
export function rotateModel90(scene: Object3D, axis: 'x' | 'y' | 'z'): void {
  const angle = Math.PI / 2
  switch (axis) {
    case 'x': scene.rotation.x += angle; break
    case 'y': scene.rotation.y += angle; break
    case 'z': scene.rotation.z += angle; break
  }
  scene.updateMatrixWorld(true)
}

/** Extract model info (vertex count, face count, texture count) */
export function extractModelInfo(
  scene: Object3D,
  bbox: BBoxResult,
): { vertexCount: number; faceCount: number; textureCount: number; dimensions: { x: number; y: number; z: number } } {
  let vertexCount = 0
  let faceCount = 0
  const textures = new Set<string>()

  scene.traverse((child) => {
    if ((child as Mesh).isMesh) {
      const mesh = child as Mesh
      const geo = mesh.geometry
      if (geo.attributes.position) {
        vertexCount += geo.attributes.position.count
      }
      if (geo.index) {
        faceCount += geo.index.count / 3
      } else if (geo.attributes.position) {
        faceCount += geo.attributes.position.count / 3
      }
      // Count textures
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of mats) {
        for (const value of Object.values(mat)) {
          if (value && typeof value === 'object' && 'isTexture' in value && value.isTexture) {
            textures.add(value.uuid)
          }
        }
      }
    }
  })

  return {
    vertexCount,
    faceCount: Math.round(faceCount),
    textureCount: textures.size,
    dimensions: {
      x: bbox.size.x,
      y: bbox.size.y,
      z: bbox.size.z,
    },
  }
}
