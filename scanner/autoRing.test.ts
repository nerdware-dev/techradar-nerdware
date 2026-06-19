import { describe, it, expect } from 'vitest'
import { autoRing } from './autoRing'

describe('autoRing', () => {
  it('returns low for exactly one repo', () => {
    expect(autoRing(1)).toBe('low')
  })
  it('returns dev for two through four repos', () => {
    expect(autoRing(2)).toBe('dev')
    expect(autoRing(4)).toBe('dev')
  })
  it('returns high for five or more repos', () => {
    expect(autoRing(5)).toBe('high')
    expect(autoRing(12)).toBe('high')
  })
  it('treats zero (or negative) as low, never out', () => {
    expect(autoRing(0)).toBe('low')
  })
})
