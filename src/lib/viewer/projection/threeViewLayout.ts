// src/lib/viewer/projection/threeViewLayout.ts
import type { ViewResult, LayoutResult, ViewKey, Vec2, BBox2D } from './types'

export function computeThreeViewLayout(
  front: ViewResult,
  left: ViewResult,
  top: ViewResult,
  gapRatio = 0.15,
): LayoutResult {
  const maxDim = Math.max(
    front.bbox.width, front.bbox.height,
    left.bbox.width, left.bbox.height,
    top.bbox.width, top.bbox.height,
  )
  const gap = gapRatio * maxDim

  const offsets: Record<ViewKey, Vec2> = {
    front: { x: left.bbox.width + gap, y: 0 },
    top:   { x: left.bbox.width + gap, y: front.bbox.height + gap },
    left:  { x: 0, y: front.bbox.height - left.bbox.height },
  }

  const totalWidth = left.bbox.width + gap + Math.max(front.bbox.width, top.bbox.width)
  const totalHeight = Math.max(front.bbox.height, left.bbox.height) + gap + top.bbox.height

  const totalBBox: BBox2D = {
    min: { x: 0, y: Math.min(0, offsets.left.y) },
    max: { x: totalWidth, y: totalHeight },
    width: totalWidth,
    height: totalHeight,
  }

  return { views: [front, left, top], offsets, totalBBox, gap }
}
