'use client'

import { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import type { BufferGeometry } from 'three'
import { useViewerStore } from '@/stores/useViewerStore'
import { useEdgeProjection } from '../hooks/useEdgeProjection'

export default function ProjectionAlgorithm() {
  const model = useViewerStore((s) => s.loadedModel)
  const showHidden = useViewerStore((s) => s.showHiddenLines)
  const { generate } = useEdgeProjection(model)
  const { invalidate } = useThree()

  const [visible, setVisible] = useState<BufferGeometry | null>(null)
  const [hidden, setHidden] = useState<BufferGeometry | null>(null)

  // Generate on view or threshold change (captured inside `generate` deps)
  useEffect(() => {
    let cancelled = false

    generate().then((result) => {
      if (cancelled || !result) return
      setVisible(result.visible)
      setHidden(result.hidden)
      invalidate()
    })

    return () => {
      cancelled = true
    }
  }, [generate, invalidate])

  // Re-render when hidden-line toggle changes
  useEffect(() => {
    invalidate()
  }, [showHidden, invalidate])

  return (
    <group>
      {/* Visible edges: solid black */}
      {visible && (
        <lineSegments geometry={visible}>
          <lineBasicMaterial color={0x000000} depthWrite={false} depthTest={false} />
        </lineSegments>
      )}

      {/* Hidden edges: dashed gray */}
      {hidden && showHidden && (
        <lineSegments
          geometry={hidden}
          onUpdate={(self) => self.computeLineDistances()}
        >
          <lineDashedMaterial
            color={0xaaaaaa}
            dashSize={0.02}
            gapSize={0.01}
            depthWrite={false}
            depthTest={false}
          />
        </lineSegments>
      )}
    </group>
  )
}
