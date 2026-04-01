import { Euler } from 'three'

export type DrawingView = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'iso'

/**
 * Rotation to apply to a model clone before Y-axis projection.
 * three-edge-projection projects along Y-axis onto XZ plane.
 * These rotations orient the model so the desired view face "looks up" at Y+.
 */
export const VIEW_ROTATIONS: Record<DrawingView, Euler> = {
  top:    new Euler(0, 0, 0),
  bottom: new Euler(Math.PI, 0, 0),
  front:  new Euler(-Math.PI / 2, 0, 0),
  back:   new Euler(-Math.PI / 2, Math.PI, 0),
  left:   new Euler(-Math.PI / 2, Math.PI / 2, 0),
  right:  new Euler(-Math.PI / 2, -Math.PI / 2, 0),
  iso:    new Euler(-Math.atan(1 / Math.SQRT2), -Math.PI / 4, 0, 'YXZ'),
}
