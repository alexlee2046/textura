import type { BufferGeometry } from 'three'

export type DrawingAlgorithm = 'edges' | 'sobel' | 'conditional' | 'projection' | 'outlines' | 'composite'

export interface ProjectionCacheEntry {
  visible: BufferGeometry
  hidden: BufferGeometry
}

export interface DrawingStats {
  computeTime: number
  lineCount: number
  visibleLineCount: number
  hiddenLineCount: number
}
