'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Outlines } from '@react-three/drei'
import { BackSide, Mesh, Vector3, Quaternion } from 'three'
import type { Group, Material } from 'three'
import { useViewerStore } from '@/stores/useViewerStore'
import { useEdgesGeometry } from '../hooks/useEdgesGeometry'
import { WhiteModelBase } from '../WhiteModelBase'

export default function CompositeAlgorithm() {
  const model = useViewerStore((s) => s.loadedModel)
  const lineWidth = useViewerStore((s) => s.drawingLineWidth)
  const setStats = useViewerStore((s) => s.setDrawingStats)
  const edgesData = useEdgesGeometry(model)
  const { invalidate } = useThree()
  const outlinesGroupRef = useRef<Group>(null)

  // Collect all meshes with their world transforms for Outlines layer
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

  // Force depthWrite=false on Outlines' internal BackSide meshes
  // to prevent z-buffer pollution that would occlude EdgesGeometry lines
  useEffect(() => {
    if (!outlinesGroupRef.current) return
    outlinesGroupRef.current.traverse((child) => {
      const m = child as Mesh
      if (m.isMesh && m.material) {
        const mat = m.material as Material
        if (mat.side === BackSide) {
          mat.depthWrite = false
        }
      }
    })
    invalidate()
  }, [meshData, invalidate])

  useEffect(() => {
    setStats({
      computeTime: 0,
      lineCount: edgesData.length + meshData.length,
      visibleLineCount: edgesData.length,
      hiddenLineCount: 0,
    })
    invalidate()
  }, [edgesData, meshData, setStats, invalidate])

  if (!model) return null

  return (
    <group>
      {/* Layer 1: White model for z-buffer occlusion */}
      <WhiteModelBase model={model} />

      {/* Layer 2: Feature edges (depth-tested, renderOrder=1) */}
      {edgesData.map((data, i) => (
        <lineSegments
          key={`edge-${i}`}
          geometry={data.geometry}
          position={data.position}
          rotation={data.rotation}
          scale={data.scale}
          renderOrder={1}
        >
          <lineBasicMaterial
            color={0x000000}
            depthTest={true}
          />
        </lineSegments>
      ))}

      {/* Layer 3: Silhouette outlines — anchor meshes are white (fills interior, same as OutlinesAlgorithm) */}
      <group ref={outlinesGroupRef}>
        {meshData.map((d, i) => (
          <mesh
            key={`outline-${i}`}
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
    </group>
  )
}
