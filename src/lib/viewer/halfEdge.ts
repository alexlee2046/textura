import type { BufferGeometry } from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export interface HalfEdgeResult {
  conditionalEdges: { a: number; b: number; c0: number; c1: number }[]
  geometry: BufferGeometry
}

export function buildConditionalEdges(inputGeo: BufferGeometry): HalfEdgeResult {
  let geo = inputGeo
  if (!geo.index) {
    geo = mergeVertices(geo)
  }
  if (!geo.index) {
    return { conditionalEdges: [], geometry: geo }
  }

  const index = geo.index.array
  const faceCount = index.length / 3

  const edgeMap = new Map<string, { faces: number[]; verts: [number, number] }>()

  for (let f = 0; f < faceCount; f++) {
    const i0 = index[f * 3]
    const i1 = index[f * 3 + 1]
    const i2 = index[f * 3 + 2]
    const verts = [i0, i1, i2]
    for (let e = 0; e < 3; e++) {
      const a = verts[e]
      const b = verts[(e + 1) % 3]
      const key = a < b ? `${a},${b}` : `${b},${a}`
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { faces: [], verts: [a, b] })
      }
      edgeMap.get(key)!.faces.push(f)
    }
  }

  const conditionalEdges: HalfEdgeResult['conditionalEdges'] = []

  for (const [, edge] of edgeMap) {
    if (edge.faces.length !== 2) continue
    const [a, b] = edge.verts
    const f0 = edge.faces[0]
    const f1 = edge.faces[1]
    const face0Verts = [index[f0 * 3], index[f0 * 3 + 1], index[f0 * 3 + 2]]
    const face1Verts = [index[f1 * 3], index[f1 * 3 + 1], index[f1 * 3 + 2]]
    const c0 = face0Verts.find((v) => v !== a && v !== b)!
    const c1 = face1Verts.find((v) => v !== a && v !== b)!
    conditionalEdges.push({ a, b, c0, c1 })
  }

  return { conditionalEdges, geometry: geo }
}
