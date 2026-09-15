import { describe, it, expect } from 'vitest'
import { placeBlips } from './placement'
import { ringRadii } from './geometry'
import { RINGS, QUADRANTS, MIN_BLIP_DISTANCE } from '../config'
import type { Blip } from '../data/types'

const mk = (name: string, ring: Blip['ring'], quadrant: Blip['quadrant']): Blip => ({
  id: name.toLowerCase(),
  name,
  ring,
  quadrant,
  isNew: false,
  description: '',
})

const blips: Blip[] = [
  mk('Docker', 'high', 'platforms'),
  mk('AWS', 'high', 'platforms'),
  mk('Kafka', 'dev', 'platforms'),
  mk('Go', 'low', 'languages-frameworks'),
]

describe('placeBlips', () => {
  it('is deterministic for the same input', () => {
    const a = placeBlips(blips, RINGS, QUADRANTS, 400)
    const b = placeBlips(blips, RINGS, QUADRANTS, 400)
    expect(a).toEqual(b)
  })

  it('places every blip within its ring band radius', () => {
    const placed = placeBlips(blips, RINGS, QUADRANTS, 400)
    for (const p of placed) {
      const r = Math.hypot(p.x, p.y)
      expect(r).toBeGreaterThan(0)
      expect(r).toBeLessThanOrEqual(400)
    }
  })

  it('numbers blips sequentially within each quadrant starting at 1', () => {
    const placed = placeBlips(blips, RINGS, QUADRANTS, 400)
    const platforms = placed
      .filter((p) => p.blip.quadrant === 'platforms')
      .map((p) => p.number)
      .sort((a, b) => a - b)
    expect(platforms).toEqual([1, 2, 3])
    const langs = placed.filter((p) => p.blip.quadrant === 'languages-frameworks')
    expect(langs[0].number).toBe(1)
  })

  it('places every blip inside its ring band', () => {
    const placed = placeBlips(blips, RINGS, QUADRANTS, 400)
    const bands = ringRadii(RINGS.length, 400)
    const ringOrder = new Map(RINGS.map((r) => [r.id, r.order]))
    for (const p of placed) {
      const band = bands[ringOrder.get(p.blip.ring)!]
      const r = Math.hypot(p.x, p.y)
      expect(r).toBeGreaterThanOrEqual(band.inner)
      expect(r).toBeLessThanOrEqual(band.outer)
    }
  })

  it('keeps a moderate number of blips in one segment at least MIN_BLIP_DISTANCE apart', () => {
    const many: Blip[] = Array.from({ length: 12 }, (_, i) => mk(`Tool ${i}`, 'high', 'platforms'))
    const placed = placeBlips(many, RINGS, QUADRANTS, 400)

    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const dist = Math.hypot(placed[i].x - placed[j].x, placed[i].y - placed[j].y)
        expect(dist).toBeGreaterThanOrEqual(MIN_BLIP_DISTANCE - 0.001)
      }
    }
  })

  it('falls back to a deterministic, non-throwing layout when a segment is very crowded', () => {
    const crowd: Blip[] = Array.from({ length: 37 }, (_, i) =>
      mk(`Framework ${i}`, 'dev', 'languages-frameworks'),
    )
    const a = placeBlips(crowd, RINGS, QUADRANTS, 400)
    const b = placeBlips(crowd, RINGS, QUADRANTS, 400)
    expect(a).toEqual(b)
    expect(a).toHaveLength(37)
  })
})
