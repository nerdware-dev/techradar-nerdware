import { describe, it, expect } from 'vitest'
import { ringLabels } from './ringLabels'
import { ringRadii } from './geometry'
import { RINGS } from '../config'

describe('ringLabels', () => {
  const labels = ringLabels(RINGS, 400)
  const bands = ringRadii(RINGS.length, 400)

  it('places one upper-case label per ring on the upward axis, mid-band, innermost first', () => {
    expect(labels.map((l) => l.text)).toEqual(['HIGH', 'DEVELOPING', 'LOW', 'OUT'])
    labels.forEach((label, i) => {
      expect(label.x).toBe(0)
      expect(-label.y).toBeCloseTo((bands[i].inner + bands[i].outer) / 2)
    })
  })

  it('sizes the box to the text length', () => {
    const [high, developing] = labels
    expect(developing.halfWidth).toBeGreaterThan(high.halfWidth)
    expect(high.halfHeight).toBe(developing.halfHeight)
  })
})
