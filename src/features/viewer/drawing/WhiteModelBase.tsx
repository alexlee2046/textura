'use client'

import { useEffect, useMemo } from 'react'
import { Mesh, SkinnedMesh, InstancedMesh, MeshBasicMaterial, DoubleSide } from 'three'
import type { Object3D } from 'three'

const whiteMat = new MeshBasicMaterial({
  color: 0xffffff,
  side: DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
})

export function WhiteModelBase({ model }: { model: Object3D | null }) {
  const cloned = useMemo(() => {
    if (!model) return null
    const clone = model.clone(true)
    clone.traverse((child) => {
      if (!(child as Mesh).isMesh) return
      if ((child as SkinnedMesh).isSkinnedMesh || (child as InstancedMesh).isInstancedMesh) {
        child.updateMatrixWorld(true)
      }
      const mesh = child as Mesh
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(() => whiteMat)
      } else {
        mesh.material = whiteMat
      }
    })
    return clone
  }, [model])

  useEffect(() => {
    return () => { /* whiteMat is singleton, don't dispose */ }
  }, [cloned])

  if (!cloned) return null
  return <primitive object={cloned} />
}
