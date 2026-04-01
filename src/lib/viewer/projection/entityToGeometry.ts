// src/lib/viewer/projection/entityToGeometry.ts
import { BufferGeometry, BufferAttribute } from 'three'
import type { Entity, Vec2 } from './types'

/** Discretize an arc into line segments */
function arcToPoints(center: Vec2, radius: number, startAngle: number, endAngle: number): Vec2[] {
  let sweep = endAngle - startAngle
  if (sweep < 0) sweep += Math.PI * 2
  const segments = Math.max(8, Math.ceil(sweep / (Math.PI / 16))) // ~32 segments per full circle
  const pts: Vec2[] = []
  for (let i = 0; i <= segments; i++) {
    const t = startAngle + sweep * (i / segments)
    pts.push({ x: center.x + radius * Math.cos(t), y: center.y + radius * Math.sin(t) })
  }
  return pts
}

/** Evaluate cubic bezier at parameter t */
function evalCubicBezier(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const mt = 1 - t
  return {
    x: mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
    y: mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y,
  }
}

/** Discretize a spline (sequence of cubic bezier segments) */
function splineToPoints(controlPoints: Vec2[], degree: number): Vec2[] {
  if (degree !== 3 || controlPoints.length < 4) return controlPoints
  const pts: Vec2[] = []
  const segCount = (controlPoints.length - 1) / 3
  const samplesPerSeg = 16
  for (let s = 0; s < segCount; s++) {
    const i = s * 3
    for (let j = 0; j <= samplesPerSeg; j++) {
      if (s > 0 && j === 0) continue // avoid duplicate at junction
      const t = j / samplesPerSeg
      pts.push(evalCubicBezier(controlPoints[i], controlPoints[i+1], controlPoints[i+2], controlPoints[i+3], t))
    }
  }
  return pts
}

/** Convert Entity[] to BufferGeometry of line segments (for <lineSegments>) */
export function entitiesToGeometry(entities: Entity[]): BufferGeometry {
  const positions: number[] = []

  for (const e of entities) {
    if (e.type === 'line') {
      positions.push(e.from.x, 0, e.from.y, e.to.x, 0, e.to.y)
    } else {
      const pts = e.type === 'arc'
        ? arcToPoints(e.center, e.radius, e.startAngle, e.endAngle)
        : splineToPoints(e.controlPoints, e.degree)
      for (let i = 0; i < pts.length - 1; i++) {
        positions.push(pts[i].x, 0, pts[i].y, pts[i+1].x, 0, pts[i+1].y)
      }
    }
  }

  const geom = new BufferGeometry()
  geom.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  return geom
}
