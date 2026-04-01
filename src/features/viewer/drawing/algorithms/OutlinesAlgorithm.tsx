'use client'

import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Outlines } from '@react-three/drei'
import { Mesh, Vector3, Quaternion } from 'three'
import { useViewerStore } from '@/stores/useViewerStore'

export default function OutlinesAlgorithm() {
  const model = useViewerStore((s) => s.loadedModel)
  const lineWidth = useViewerStore((s) => s.drawingLineWidth)
  const setStats = useViewerStore((s) => s.setDrawingStats)
  const { invalidate } = useThree()

  // Collect all meshes with their world transforms (computed once)
  const meshData = useMemo(() => {
    if (!model) return []
    const _pos = new Vector3()
    const _quat = new Quaternion()
    const _scale = new Vector3()
    const result: {
      mesh: Mesh
      position: [number, number, number]
      quaternion: [number, number, number, number]
      scale: [number, number, number]
    }[] = []

    model.traverse((child) => {
      if (!(child as Mesh).isMesh) return
      const mesh = child as Mesh
      mesh.updateMatrixWorld(true)
      const pos = mesh.getWorldPosition(_pos.clone())
      const quat = mesh.getWorldQuaternion(_quat.clone())
      const scale = mesh.getWorldScale(_scale.clone())
      result.push({
        mesh,
        position: [pos.x, pos.y, pos.z],
        quaternion: [quat.x, quat.y, quat.z, quat.w],
        scale: [scale.x, scale.y, scale.z],
      })
    })
    return result
  }, [model])

  useEffect(() => {
    setStats({ computeTime: 0, lineCount: meshData.length, visibleLineCount: meshData.length, hiddenLineCount: 0 })
    invalidate()
  }, [meshData, setStats, invalidate])

  if (!model) return null

  return (
    <group>
      {meshData.map((d, i) => (
        <mesh
          key={i}
          geometry={d.mesh.geometry}
          position={d.position}
          quaternion={d.quaternion}
          scale={d.scale}
        >
          <meshBasicMaterial color={0xffffff} />
          <Outlines thickness={lineWidth} color="black" screenspace />
        </mesh>
      ))}
    </group>
  )
}
