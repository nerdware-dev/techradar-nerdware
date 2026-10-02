import { describe, it, expect } from 'vitest'
import { sweepPhase } from './sweep'

describe('sweepPhase', () => {
  it('is 0 straight up, where every revolution starts', () => {
    expect(sweepPhase(0, -100)).toBe(0)
  })

  it('advances clockwise on screen: right, bottom, left', () => {
    expect(sweepPhase(100, 0)).toBeCloseTo(0.25)
    expect(sweepPhase(0, 100)).toBeCloseTo(0.5)
    expect(sweepPhase(-100, 0)).toBeCloseTo(0.75)
  })

  it('stays below 1 just counter-clockwise of the start', () => {
    const phase = sweepPhase(-1, -100)
    expect(phase).toBeGreaterThan(0.99)
    expect(phase).toBeLessThan(1)
  })
})
