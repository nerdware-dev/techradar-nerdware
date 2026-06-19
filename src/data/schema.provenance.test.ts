import { describe, it, expect } from 'vitest'
import { parseRadar } from './schema'

describe('parseRadar with scanner provenance fields', () => {
  const withProvenance = [
    {
      name: 'React',
      ring: 'high',
      quadrant: 'languages-frameworks',
      isNew: false,
      description: 'UI.',
      detected: { repoCount: 7, lastSeen: '2026-06-18', sourceRepos: ['a', 'b'] },
      autoRing: 'high',
      ringOverride: 'dev',
      pinned: true,
      needsReview: false,
    },
  ]

  it('parses blips carrying extra provenance fields without throwing', () => {
    const radar = parseRadar(withProvenance)
    expect(radar.blips[0].ring).toBe('high')
    expect(radar.blips[0].quadrant).toBe('languages-frameworks')
  })

  it('renders only the standard fields the app needs', () => {
    const radar = parseRadar(withProvenance)
    expect(Object.keys(radar.blips[0]).sort()).toEqual(
      ['description', 'id', 'isNew', 'name', 'quadrant', 'ring'].sort(),
    )
  })
})
