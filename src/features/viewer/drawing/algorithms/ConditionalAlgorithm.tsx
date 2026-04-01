'use client'

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { useViewerStore } from '@/stores/useViewerStore'
import { useConditionalLines } from '../hooks/useConditionalLines'

export default function ConditionalAlgorithm() {
  const model = useViewerStore((s) => s.loadedModel)
  const data = useConditionalLines(model)
  const { invalidate } = useThree()

  useEffect(() => {
    invalidate()
  }, [data, invalidate])

  return (
    <group>
      {data.map((d, i) => (
        <group key={i}>
          <lineSegments geometry={d.conditionalGeometry} material={d.material} renderOrder={1} />
          <lineSegments geometry={d.featureGeometry} renderOrder={1}>
            <lineBasicMaterial color={0x000000} depthTest={true} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
          </lineSegments>
        </group>
      ))}
    </group>
  )
}
