import type { Blip, Ring, Quadrant } from '../data/types'
import { ringRadii, quadrantAngles, polarToCartesian } from './geometry'

export interface PlacedBlip {
  blip: Blip
  x: number
  y: number
  number: number
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PAD = 0.12 // fraction of band/sector kept clear of edges

export function placeBlips(
  blips: Blip[],
  rings: Ring[],
  quadrants: Quadrant[],
  maxRadius: number,
): PlacedBlip[] {
  const bands = ringRadii(rings.length, maxRadius)
  const ringOrder = new Map(rings.map((r) => [r.id, r.order]))
  const result: PlacedBlip[] = []

  for (const q of quadrants) {
    const { start, end } = quadrantAngles(q.order)
    const angleSpan = end - start
    const inQuadrant = blips
      .filter((b) => b.quadrant === q.id)
      .sort(
        (a, b) => ringOrder.get(a.ring)! - ringOrder.get(b.ring)! || a.name.localeCompare(b.name),
      )

    inQuadrant.forEach((blip, i) => {
      const band = bands[ringOrder.get(blip.ring)!]
      const rng = mulberry32(hashString(blip.name))
      const angle = start + angleSpan * (PAD + rng() * (1 - 2 * PAD))
      const radius = band.inner + (band.outer - band.inner) * (PAD + rng() * (1 - 2 * PAD))
      const { x, y } = polarToCartesian(angle, radius)
      result.push({ blip, x, y, number: i + 1 })
    })
  }

  return result
}
