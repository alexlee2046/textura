'use client'

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { useViewerStore } from '@/stores/useViewerStore'
import { useEdgesGeometry } from '../hooks/useEdgesGeometry'

export default function EdgesAlgorithm() {
  const model = useViewerStore((s) => s.loadedModel)
  const edgesData = useEdgesGeometry(model)
  const { invalidate } = useThree()

  useEffect(() => {
    invalidate()
  }, [edgesData, invalidate])

  return (
    <group>
      {edgesData.map((data, i) => (
        <lineSegments
          key={i}
          geometry={data.geometry}
          position={data.position}
          rotation={data.rotation}
          scale={data.scale}
          renderOrder={1}
        >
          <lineBasicMaterial color={0x000000} depthTest={true} />
        </lineSegments>
      ))}
    </group>
  )
}
