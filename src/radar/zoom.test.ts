import { describe, it, expect } from 'vitest'
import { applyZoom, NO_ZOOM, quadrantZoom } from './zoom'

describe('quadrantZoom', () => {
  it('maps the quadrant square onto the full radar extent', () => {
    // order 3 = languages & frameworks, the upper-right quadrant (x ≥ 0, y ≤ 0)
    const zoom = quadrantZoom(3, 400)
    expect(applyZoom(zoom, { x: 0, y: 0 })).toEqual({ x: -400, y: 400 })
    expect(applyZoom(zoom, { x: 400, y: -400 })).toEqual({ x: 400, y: -400 })
    expect(applyZoom(zoom, { x: 200, y: -200 })).toEqual({ x: 0, y: 0 })
  })

  it('centres each quadrant in the direction of its sector', () => {
    // order 0 = techniques, lower right; order 1 = platforms, lower left
    expect(applyZoom(quadrantZoom(0, 400), { x: 200, y: 200 })).toEqual({ x: 0, y: 0 })
    expect(applyZoom(quadrantZoom(1, 400), { x: -200, y: 200 })).toEqual({ x: 0, y: 0 })
  })
})

describe('applyZoom', () => {
  it('leaves points unchanged without zoom', () => {
    expect(applyZoom(NO_ZOOM, { x: 12, y: -7 })).toEqual({ x: 12, y: -7 })
  })
})
