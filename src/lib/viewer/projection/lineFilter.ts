// src/lib/viewer/projection/lineFilter.ts
// Pure math module — no Three.js, no DOM, no React. Web Worker safe.

import type { Segment, PostProcessOptions } from './types'
import { DEFAULT_POST_PROCESS_OPTIONS, segmentLength } from './types'

/** Normalize segment so p1 < p2 lexicographically (x first, then y). */
function normalizeEndpoints(s: Segment): Segment {
  if (s.p1.x < s.p2.x || (s.p1.x === s.p2.x && s.p1.y <= s.p2.y)) {
    return s
  }
  return { p1: s.p2, p2: s.p1 }
}

// ─── Stage 1: Remove degenerates ───

function removeDegenerates(segs: Segment[]): Segment[] {
  return segs.filter(s => segmentLength(s) > 1e-8)
}

// ─── Stage 2: Deduplicate segments ───

function deduplicateSegments(segs: Segment[], D: number): Segment[] {
  const tolerance = 1e-4 * D
  const cellSize = tolerance
  const seen = new Map<string, Segment[]>()
  const result: Segment[] = []

  for (const raw of segs) {
    const s = normalizeEndpoints(raw)

    // Check surrounding cells for near-duplicates
    const kx1 = Math.floor(s.p1.x / cellSize)
    const ky1 = Math.floor(s.p1.y / cellSize)
    const kx2 = Math.floor(s.p2.x / cellSize)
    const ky2 = Math.floor(s.p2.y / cellSize)
    const compositeKey = `${kx1},${ky1}|${kx2},${ky2}`

    let isDuplicate = false

    // Check this cell and neighboring cells
    for (let dx1 = -1; dx1 <= 1 && !isDuplicate; dx1++) {
      for (let dy1 = -1; dy1 <= 1 && !isDuplicate; dy1++) {
        for (let dx2 = -1; dx2 <= 1 && !isDuplicate; dx2++) {
          for (let dy2 = -1; dy2 <= 1 && !isDuplicate; dy2++) {
            const neighborKey = `${kx1 + dx1},${ky1 + dy1}|${kx2 + dx2},${ky2 + dy2}`
            const bucket = seen.get(neighborKey)
            if (!bucket) continue
            for (const existing of bucket) {
              const d1x = Math.abs(s.p1.x - existing.p1.x)
              const d1y = Math.abs(s.p1.y - existing.p1.y)
              const d2x = Math.abs(s.p2.x - existing.p2.x)
              const d2y = Math.abs(s.p2.y - existing.p2.y)
              if (d1x <= tolerance && d1y <= tolerance && d2x <= tolerance && d2y <= tolerance) {
                isDuplicate = true
                break
              }
            }
          }
        }
      }
    }

    if (!isDuplicate) {
      result.push(raw)
      const bucket = seen.get(compositeKey)
      if (bucket) {
        bucket.push(s)
      } else {
        seen.set(compositeKey, [s])
      }
    }
  }

  return result
}

// ─── Stage 3: Filter short segments ───

function filterShortSegments(segs: Segment[], D: number, ratio: number): Segment[] {
  const threshold = ratio * D
  return segs.filter(s => segmentLength(s) >= threshold)
}

// ─── Stage 4: Merge near-parallel segments ───

function mergeNearParallel(segs: Segment[], D: number): Segment[] {
  if (segs.length <= 1) return segs

  const angleThresholdRad = (2 * Math.PI) / 180 // 2 degrees
  const gapThreshold = 1e-4 * D
  const overlapRatio = 0.8

  // Compute direction vectors (normalized) for each segment
  interface SegInfo {
    seg: Segment
    len: number
    dx: number
    dy: number
    merged: boolean
  }

  const infos: SegInfo[] = segs.map(s => {
    const n = normalizeEndpoints(s)
    const len = segmentLength(s)
    return {
      seg: s,
      len,
      dx: len > 0 ? (n.p2.x - n.p1.x) / len : 0,
      dy: len > 0 ? (n.p2.y - n.p1.y) / len : 0,
      merged: false,
    }
  })

  const result: Segment[] = []

  for (let i = 0; i < infos.length; i++) {
    if (infos[i].merged) continue

    let bestMerge = -1
    let bestOverlap = 0

    for (let j = i + 1; j < infos.length; j++) {
      if (infos[j].merged) continue

      const a = infos[i]
      const b = infos[j]

      // Check near-parallel: |cross product| < sin(threshold)
      const cross = Math.abs(a.dx * b.dy - a.dy * b.dx)
      if (cross > Math.sin(angleThresholdRad)) continue

      // Check perpendicular distance between lines
      // Use midpoint of b projected onto line of a
      const aN = normalizeEndpoints(a.seg)
      const bN = normalizeEndpoints(b.seg)
      const midBx = (bN.p1.x + bN.p2.x) / 2
      const midBy = (bN.p1.y + bN.p2.y) / 2

      // Perpendicular distance from midB to line through a
      const vx = midBx - aN.p1.x
      const vy = midBy - aN.p1.y
      const perpDist = Math.abs(vx * (-a.dy) + vy * a.dx)
      if (perpDist > gapThreshold) continue

      // Check overlap along direction axis
      // Project all 4 endpoints onto the direction of a
      const proj = (x: number, y: number) => x * a.dx + y * a.dy
      const aProj1 = proj(aN.p1.x, aN.p1.y)
      const aProj2 = proj(aN.p2.x, aN.p2.y)
      const bProj1 = proj(bN.p1.x, bN.p1.y)
      const bProj2 = proj(bN.p2.x, bN.p2.y)

      const aMin = Math.min(aProj1, aProj2)
      const aMax = Math.max(aProj1, aProj2)
      const bMin = Math.min(bProj1, bProj2)
      const bMax = Math.max(bProj1, bProj2)

      const overlapStart = Math.max(aMin, bMin)
      const overlapEnd = Math.min(aMax, bMax)
      const overlapLen = Math.max(0, overlapEnd - overlapStart)

      const shorterLen = Math.min(a.len, b.len)
      if (shorterLen > 0 && overlapLen / shorterLen >= overlapRatio) {
        if (overlapLen > bestOverlap) {
          bestOverlap = overlapLen
          bestMerge = j
        }
      }
    }

    if (bestMerge >= 0) {
      // Keep the longer segment
      const a = infos[i]
      const b = infos[bestMerge]
      b.merged = true
      if (b.len > a.len) {
        // Replace a's segment with b's
        infos[i].seg = b.seg
        infos[i].len = b.len
        infos[i].dx = b.dx
        infos[i].dy = b.dy
      }
    }

    result.push(infos[i].seg)
  }

  return result
}

// ─── Orchestrator ───

export function filterSegments(
  segs: Segment[],
  D: number,
  opts?: Partial<PostProcessOptions>,
): Segment[] {
  if (segs.length === 0) return []

  const options = { ...DEFAULT_POST_PROCESS_OPTIONS, ...opts }

  let result = removeDegenerates(segs)
  result = deduplicateSegments(result, D)
  result = filterShortSegments(result, D, options.minSegmentRatio)
  result = mergeNearParallel(result, D)

  return result
}
