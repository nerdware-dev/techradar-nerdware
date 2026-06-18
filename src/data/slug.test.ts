import { describe, it, expect } from 'vitest'
import { slugify } from './slug'

describe('slugify', () => {
  it('lowercases and trims', () => {
    expect(slugify('  High ')).toBe('high')
  })
  it('collapses non-alphanumerics to single hyphens', () => {
    expect(slugify('languages & frameworks')).toBe('languages-frameworks')
  })
  it('strips leading/trailing hyphens', () => {
    expect(slugify('  Tools!  ')).toBe('tools')
  })
})
