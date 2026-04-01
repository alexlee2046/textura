import { Mesh, Texture, type Object3D, type Material } from 'three'

function disposeMaterial(mat: Material): void {
  for (const value of Object.values(mat)) {
    if (value instanceof Texture) {
      value.dispose()
    }
  }
  mat.dispose()
}

/** Recursively dispose all GPU resources (geometry, material, texture, BVH) */
export function disposeModel(obj: Object3D): void {
  obj.traverse((child) => {
    if (child instanceof Mesh) {
      // BVH acceleration structure
      if ('disposeBoundsTree' in child.geometry) {
        ;(child.geometry as { disposeBoundsTree: () => void }).disposeBoundsTree()
      }
      child.geometry.dispose()

      if (Array.isArray(child.material)) {
        child.material.forEach(disposeMaterial)
      } else {
        disposeMaterial(child.material)
      }
    }
  })
}
