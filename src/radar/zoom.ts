import { polarToCartesian, quadrantAngles } from './geometry'

/** Maps a radar point p to scale · p + (x, y) in the drawing. */
export interface Zoom {
  scale: number
  x: number
  y: number
}

export const NO_ZOOM: Zoom = { scale: 1, x: 0, y: 0 }

/**
 * The zoom that makes one quadrant fill the area the whole radar normally covers: the
 * quadrant's square (side maxRadius) is scaled by 2 and centred on the origin.
 */
export function quadrantZoom(order: number, maxRadius: number): Zoom {
  const { start, end } = quadrantAngles(order)
  const direction = polarToCartesian((start + end) / 2, 1)
  const scale = 2
  return {
    scale,
    x: -scale * Math.sign(direction.x) * (maxRadius / 2),
    y: -scale * Math.sign(direction.y) * (maxRadius / 2),
  }
}

export function applyZoom(zoom: Zoom, point: { x: number; y: number }): { x: number; y: number } {
  return { x: zoom.scale * point.x + zoom.x, y: zoom.scale * point.y + zoom.y }
}

/** CSS transform for an element whose children are drawn in radar coordinates. */
export function zoomTransform(zoom: Zoom): string {
  return `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`
}

/** CSS transform that moves an unscaled element (dot, label) to a radar point. */
export function zoomedTranslate(zoom: Zoom, point: { x: number; y: number }): string {
  const { x, y } = applyZoom(zoom, point)
  return `translate(${x}px, ${y}px)`
}
