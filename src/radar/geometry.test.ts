import { describe, it, expect } from 'vitest'
import { ringRadii, polarToCartesian, quadrantAngles, annularSectorPath } from './geometry'

describe('geometry', () => {
  it('produces contiguous, increasing, area-balanced rings ending at maxRadius', () => {
    const r = ringRadii(4, 400)
    expect(r).toHaveLength(4)
    expect(r[0].inner).toBe(0)
    expect(r[3].outer).toBeCloseTo(400)
    // contiguous
    expect(r[1].inner).toBeCloseTo(r[0].outer)
    // increasing
    expect(r[1].outer).toBeGreaterThan(r[0].outer)
    // equal area: each band area ~ pi*max^2/4
    const area = (b: { inner: number; outer: number }) => Math.PI * (b.outer ** 2 - b.inner ** 2)
    expect(area(r[0])).toBeCloseTo(area(r[3]), 5)
  })

  it('maps polar to cartesian with y pointing down', () => {
    expect(polarToCartesian(0, 100)).toEqual({ x: 100, y: 0 })
    const p = polarToCartesian(90, 100)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(100)
  })

  it('splits the circle into 4 consecutive 90° sectors', () => {
    expect(quadrantAngles(0)).toEqual({ start: 0, end: 90 })
    expect(quadrantAngles(3)).toEqual({ start: 270, end: 360 })
  })

  it('builds a closed annular sector path', () => {
    const d = annularSectorPath(0, 90, 100, 200)
    expect(d.startsWith('M')).toBe(true)
    expect(d.trim().endsWith('Z')).toBe(true)
    expect(d).toContain('A')
  })
})
