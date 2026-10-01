import { describe, it, expect } from 'vitest'
import { parseRadar } from './schema'

const valid = [
  {
    name: 'Apache Kafka',
    ring: 'High',
    quadrant: 'platforms',
    description: 'Streaming <a href="https://kafka.apache.org">link</a>',
  },
  { name: 'PHP', ring: 'Out', quadrant: 'languages & frameworks', description: 'x' },
]

describe('parseRadar', () => {
  it('normalizes ring and quadrant case-insensitively to ids', () => {
    const radar = parseRadar(valid)
    expect(radar.blips[0].ring).toBe('high')
    expect(radar.blips[1].quadrant).toBe('languages-frameworks')
  })

  describe('isNew', () => {
    const NOW = new Date('2026-10-01T12:00:00Z')
    const added = (addedAt?: string) =>
      parseRadar([{ name: 'X', ring: 'high', quadrant: 'tools', addedAt }], NOW).blips[0]

    it('is true from the day an entry was added through the end of the window', () => {
      expect(added('2026-10-01').isNew).toBe(true)
      expect(added('2026-07-04').isNew).toBe(true) // day 89
    })

    it('is false once NEW_WINDOW_DAYS have passed', () => {
      expect(added('2026-07-03').isNew).toBe(false) // day 90
      expect(added('2023-04-18').isNew).toBe(false)
    })

    it('is false for an entry without addedAt', () => {
      expect(added(undefined).isNew).toBe(false)
    })

    it('rejects an addedAt that is not a YYYY-MM-DD calendar date', () => {
      expect(() => added('17.08.2026')).toThrow()
      expect(() => added('2026-02-30')).toThrow()
    })
  })

  it('assigns a stable slug id from the name', () => {
    const radar = parseRadar(valid)
    expect(radar.blips[0].id).toBe('apache-kafka')
  })

  it('keeps safe anchor tags but strips dangerous markup', () => {
    const radar = parseRadar([
      { name: 'X', ring: 'high', quadrant: 'tools', description: '<a href="https://a.b">k</a><script>alert(1)</script>' },
    ])
    expect(radar.blips[0].description).toContain('<a')
    expect(radar.blips[0].description).not.toContain('<script')
  })

  it('attaches the canonical rings and quadrants', () => {
    const radar = parseRadar(valid)
    expect(radar.rings.map((r) => r.id)).toEqual(['high', 'dev', 'low', 'out'])
    expect(radar.quadrants).toHaveLength(4)
  })

  it('throws a clear error on an unknown ring', () => {
    expect(() =>
      parseRadar([{ name: 'X', ring: 'banana', quadrant: 'tools', description: '' }]),
    ).toThrow(/ring/i)
  })

  it('throws when the payload is not an array', () => {
    expect(() => parseRadar({ nope: true })).toThrow()
  })
})

import realData from '../../data/tech-radar.json'
it('parses the real tech-radar.json without throwing', () => {
  const radar = parseRadar(realData)
  // The scanner grows the radar over time; assert the curated baseline is never lost
  // rather than an exact count.
  expect(radar.blips.length).toBeGreaterThanOrEqual(45)
})
