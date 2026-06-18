import { describe, it, expect } from 'vitest'
import { parseRadar } from './schema'

const valid = [
  {
    name: 'Apache Kafka',
    ring: 'High',
    quadrant: 'platforms',
    isNew: 'FALSE',
    description: 'Streaming <a href="https://kafka.apache.org">link</a>',
  },
  { name: 'PHP', ring: 'Out', quadrant: 'languages & frameworks', isNew: 'TRUE', description: 'x' },
]

describe('parseRadar', () => {
  it('normalizes ring and quadrant case-insensitively to ids', () => {
    const radar = parseRadar(valid)
    expect(radar.blips[0].ring).toBe('high')
    expect(radar.blips[1].quadrant).toBe('languages-frameworks')
  })

  it('coerces isNew string to boolean', () => {
    const radar = parseRadar(valid)
    expect(radar.blips[0].isNew).toBe(false)
    expect(radar.blips[1].isNew).toBe(true)
  })

  it('assigns a stable slug id from the name', () => {
    const radar = parseRadar(valid)
    expect(radar.blips[0].id).toBe('apache-kafka')
  })

  it('keeps safe anchor tags but strips dangerous markup', () => {
    const radar = parseRadar([
      { name: 'X', ring: 'high', quadrant: 'tools', isNew: 'FALSE', description: '<a href="https://a.b">k</a><script>alert(1)</script>' },
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
      parseRadar([{ name: 'X', ring: 'banana', quadrant: 'tools', isNew: 'FALSE', description: '' }]),
    ).toThrow(/ring/i)
  })

  it('throws when the payload is not an array', () => {
    expect(() => parseRadar({ nope: true })).toThrow()
  })
})

import realData from '../../data/tech-radar.json'
it('parses the real tech-radar.json without throwing', () => {
  const radar = parseRadar(realData)
  expect(radar.blips).toHaveLength(45)
})
