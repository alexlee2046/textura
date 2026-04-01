// src/lib/viewer/projection/lineGraph.ts
// Pure math module — no Three.js, no DOM, no React. Web Worker safe.
//
// Builds an adjacency graph from raw segments, extracts ordered chains,
// prunes small isolated clusters, and splits at branch nodes (degree >= 3).

import type { Vec2, Segment, Chain, PostProcessOptions } from './types'
import { DEFAULT_POST_PROCESS_OPTIONS, dist, segmentLength } from './types'

// ─── Union-Find ───

class UnionFind {
  private parent: number[]
  private rank: number[]

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i)
    this.rank = new Array(n).fill(0)
  }

  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]] // path compression
      x = this.parent[x]
    }
    return x
  }

  union(a: number, b: number): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return
    if (this.rank[ra] < this.rank[rb]) {
      this.parent[ra] = rb
    } else if (this.rank[ra] > this.rank[rb]) {
      this.parent[rb] = ra
    } else {
      this.parent[rb] = ra
      this.rank[ra]++
    }
  }
}

// ─── Endpoint merging with two-level grid hash ───

/**
 * Merge nearby endpoints using a grid-based spatial hash + Union-Find.
 * Returns a mapping from original endpoint index to canonical EndpointInfo.
 */
function mergeEndpoints(
  segments: Segment[],
  D: number,
  mergeDistanceRatio: number,
): { endpointMap: Map<number, number>; positions: Map<number, Vec2> } {
  // Collect all endpoints: index 2*i = p1 of segment i, 2*i+1 = p2 of segment i
  const points: Vec2[] = []
  for (const s of segments) {
    points.push(s.p1, s.p2)
  }

  const n = points.length
  const uf = new UnionFind(n)

  // Two-level merging
  const epsilons = [
    1e-4 * D,                   // Level 1: high confidence
    mergeDistanceRatio * D,     // Level 2: broader merge
  ]

  for (const eps of epsilons) {
    if (eps <= 0) continue
    const cellSize = eps
    const grid = new Map<string, number[]>()

    // Insert all points into grid
    for (let i = 0; i < n; i++) {
      const p = points[i]
      const cx = Math.floor(p.x / cellSize)
      const cy = Math.floor(p.y / cellSize)
      const key = `${cx},${cy}`
      const bucket = grid.get(key)
      if (bucket) {
        bucket.push(i)
      } else {
        grid.set(key, [i])
      }
    }

    // For each point, check neighboring cells for merge candidates
    for (let i = 0; i < n; i++) {
      const p = points[i]
      const cx = Math.floor(p.x / cellSize)
      const cy = Math.floor(p.y / cellSize)

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${cx + dx},${cy + dy}`
          const bucket = grid.get(key)
          if (!bucket) continue
          for (const j of bucket) {
            if (j <= i) continue // avoid duplicate checks
            if (uf.find(i) === uf.find(j)) continue // already merged
            if (dist(points[i], points[j]) <= eps) {
              uf.union(i, j)
            }
          }
        }
      }
    }
  }

  // Build canonical positions (centroid of each merged group)
  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const root = uf.find(i)
    const group = groups.get(root)
    if (group) {
      group.push(i)
    } else {
      groups.set(root, [i])
    }
  }

  // Assign sequential IDs and compute centroids
  const positions = new Map<number, Vec2>()
  const rootToId = new Map<number, number>()
  let nextId = 0

  for (const [root, members] of groups) {
    let sx = 0
    let sy = 0
    for (const idx of members) {
      sx += points[idx].x
      sy += points[idx].y
    }
    const id = nextId++
    rootToId.set(root, id)
    positions.set(id, { x: sx / members.length, y: sy / members.length })
  }

  // Build endpoint index -> canonical ID map
  const endpointMap = new Map<number, number>()
  for (let i = 0; i < n; i++) {
    endpointMap.set(i, rootToId.get(uf.find(i))!)
  }

  return { endpointMap, positions }
}

// ─── Adjacency graph ───

interface GraphNode {
  neighbors: Set<number>
  position: Vec2
}

function buildAdjacencyGraph(
  segments: Segment[],
  endpointMap: Map<number, number>,
  positions: Map<number, Vec2>,
): Map<number, GraphNode> {
  const graph = new Map<number, GraphNode>()

  // Initialize all nodes
  for (const [id, pos] of positions) {
    graph.set(id, { neighbors: new Set(), position: pos })
  }

  // Add edges from segments
  for (let i = 0; i < segments.length; i++) {
    const u = endpointMap.get(2 * i)!
    const v = endpointMap.get(2 * i + 1)!
    if (u === v) continue // skip degenerate (self-loop)
    graph.get(u)!.neighbors.add(v)
    graph.get(v)!.neighbors.add(u)
  }

  return graph
}

// ─── Connected components via BFS ───

interface Component {
  nodeIds: Set<number>
  segmentCount: number
  totalLength: number
}

function findComponents(
  graph: Map<number, GraphNode>,
  segments: Segment[],
  endpointMap: Map<number, number>,
): Component[] {
  // Pre-build node-to-segment mapping in one O(S) pass
  const nodeSegments = new Map<number, { count: number; totalLength: number }>()
  for (let i = 0; i < segments.length; i++) {
    const u = endpointMap.get(2 * i)!
    const v = endpointMap.get(2 * i + 1)!
    if (u === v) continue
    const len = segmentLength(segments[i])
    // Attribute each segment to node u (arbitrary but consistent per component)
    const entry = nodeSegments.get(u)
    if (entry) {
      entry.count++
      entry.totalLength += len
    } else {
      nodeSegments.set(u, { count: 1, totalLength: len })
    }
  }

  const visited = new Set<number>()
  const components: Component[] = []

  for (const [startId] of graph) {
    if (visited.has(startId)) continue

    const nodeIds = new Set<number>()
    const queue: number[] = [startId]
    visited.add(startId)

    let segCount = 0
    let totalLen = 0

    let head = 0
    while (head < queue.length) {
      const current = queue[head++]
      nodeIds.add(current)

      // Accumulate segment stats from pre-built mapping
      const seg = nodeSegments.get(current)
      if (seg) {
        segCount += seg.count
        totalLen += seg.totalLength
      }

      const node = graph.get(current)!
      for (const neighbor of node.neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }

    components.push({ nodeIds, segmentCount: segCount, totalLength: totalLen })
  }

  return components
}

// ─── Chain extraction ───

function extractChainsFromComponent(
  component: Component,
  graph: Map<number, GraphNode>,
): Chain[] {
  const chains: Chain[] = []
  const usedEdges = new Set<string>()

  function edgeKey(a: number, b: number): string {
    return a < b ? `${a}-${b}` : `${b}-${a}`
  }

  // Collect degree info within this component
  const leaves: number[] = []    // degree 1
  const branches: number[] = []  // degree >= 3
  let allDeg2 = true

  for (const nodeId of component.nodeIds) {
    const node = graph.get(nodeId)!
    // Count only neighbors within this component
    let degree = 0
    for (const n of node.neighbors) {
      if (component.nodeIds.has(n)) degree++
    }
    if (degree === 1) {
      leaves.push(nodeId)
      allDeg2 = false
    } else if (degree >= 3) {
      branches.push(nodeId)
      allDeg2 = false
    }
  }

  // Helper: walk from a start node, collecting points
  function walkChain(start: number, firstNeighbor: number): { points: Vec2[]; endNode: number } {
    const points: Vec2[] = [graph.get(start)!.position]
    usedEdges.add(edgeKey(start, firstNeighbor))

    let prev = start
    let current = firstNeighbor

    while (true) {
      points.push(graph.get(current)!.position)

      // Get degree within component
      const node = graph.get(current)!
      const componentNeighbors: number[] = []
      for (const n of node.neighbors) {
        if (component.nodeIds.has(n)) componentNeighbors.push(n)
      }
      const degree = componentNeighbors.length

      // Stop at leaves (degree 1) or branches (degree >= 3)
      if (degree !== 2) break

      // Continue to the next unvisited neighbor
      let next = -1
      for (const n of componentNeighbors) {
        if (n !== prev && !usedEdges.has(edgeKey(current, n))) {
          next = n
          break
        }
      }

      if (next === -1) break // no unvisited edges

      usedEdges.add(edgeKey(current, next))
      prev = current
      current = next
    }

    return { points, endNode: current }
  }

  // Case 1: All degree-2 nodes -> closed chain (cycle)
  if (allDeg2 && component.nodeIds.size > 0) {
    const start = component.nodeIds.values().next().value!
    const node = graph.get(start)!
    const componentNeighbors: number[] = []
    for (const n of node.neighbors) {
      if (component.nodeIds.has(n)) componentNeighbors.push(n)
    }

    if (componentNeighbors.length >= 1) {
      const first = componentNeighbors[0]
      const { points } = walkChain(start, first)
      chains.push({ points, closed: true })
    }
    return chains
  }

  // Case 2: Start from leaves
  for (const leaf of leaves) {
    const node = graph.get(leaf)!
    for (const neighbor of node.neighbors) {
      if (!component.nodeIds.has(neighbor)) continue
      if (usedEdges.has(edgeKey(leaf, neighbor))) continue
      const { points } = walkChain(leaf, neighbor)
      if (points.length >= 2) {
        chains.push({ points, closed: false })
      }
    }
  }

  // Case 3: Start from branch nodes for any remaining unused edges
  for (const branch of branches) {
    const node = graph.get(branch)!
    for (const neighbor of node.neighbors) {
      if (!component.nodeIds.has(neighbor)) continue
      if (usedEdges.has(edgeKey(branch, neighbor))) continue
      const { points } = walkChain(branch, neighbor)
      if (points.length >= 2) {
        chains.push({ points, closed: false })
      }
    }
  }

  // Case 4: Any remaining unused edges (cycles within mixed-degree components)
  for (const nodeId of component.nodeIds) {
    const node = graph.get(nodeId)!
    for (const neighbor of node.neighbors) {
      if (!component.nodeIds.has(neighbor)) continue
      if (usedEdges.has(edgeKey(nodeId, neighbor))) continue
      const { points } = walkChain(nodeId, neighbor)
      if (points.length >= 2) {
        chains.push({ points, closed: false })
      }
    }
  }

  return chains
}

// ─── Main export ───

export function buildChains(
  segments: Segment[],
  D: number,
  opts?: Partial<PostProcessOptions>,
): Chain[] {
  if (segments.length === 0) return []

  const options = { ...DEFAULT_POST_PROCESS_OPTIONS, ...opts }

  // Step 1: Merge endpoints
  const { endpointMap, positions } = mergeEndpoints(segments, D, options.mergeDistanceRatio)

  // Step 2: Build adjacency graph
  const graph = buildAdjacencyGraph(segments, endpointMap, positions)

  // Step 3: Find connected components
  const components = findComponents(graph, segments, endpointMap)

  // Step 4: Prune small isolated clusters (compound condition: BOTH must be true)
  const surviving = components.filter(c =>
    !(c.segmentCount < options.minClusterSegments && c.totalLength < options.minClusterLenRatio * D),
  )

  // Step 5: Extract chains from each surviving component
  const chains: Chain[] = []
  for (const component of surviving) {
    const componentChains = extractChainsFromComponent(component, graph)
    chains.push(...componentChains)
  }

  return chains
}
