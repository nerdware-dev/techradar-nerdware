import type { Blip, Ring, Quadrant } from '../data/types'
import { MIN_BLIP_DISTANCE } from '../config'
import { ringRadii, quadrantAngles, polarToCartesian } from './geometry'

export interface PlacedBlip {
  blip: Blip
  x: number
  y: number
  number: number
}

interface Point {
  x: number
  y: number
}

interface Band {
  inner: number
  outer: number
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
const MAX_RANDOM_ATTEMPTS = 40

function randomAngleAndRadius(
  rng: () => number,
  start: number,
  angleSpan: number,
  band: Band,
): { angle: number; radius: number } {
  const angle = start + angleSpan * (PAD + rng() * (1 - 2 * PAD))
  const radius = band.inner + (band.outer - band.inner) * (PAD + rng() * (1 - 2 * PAD))
  return { angle, radius }
}

/**
 * Deterministic fallback grid over the padded band/sector, spaced so that any
 * two grid points are at least minDistance apart: rows step by minDistance in
 * radius, and each row's angular step is widened at smaller radii so that the
 * resulting arc length still meets minDistance.
 */
function* gridCandidates(
  start: number,
  angleSpan: number,
  band: Band,
  minDistance: number,
): Generator<{ angle: number; radius: number }> {
  const bandWidth = band.outer - band.inner
  const innerBound = band.inner + PAD * bandWidth
  const outerBound = band.outer - PAD * bandWidth
  const angleStart = start + PAD * angleSpan
  const angleEnd = start + (1 - PAD) * angleSpan

  for (let radius = innerBound; radius <= outerBound; radius += minDistance) {
    const angleStepDeg = (minDistance / radius) * (180 / Math.PI)
    for (let angle = angleStart; angle <= angleEnd; angle += angleStepDeg) {
      yield { angle, radius }
    }
  }
}

function closestDistance(point: Point, others: Point[]): number {
  if (others.length === 0) return Infinity
  return Math.min(...others.map((o) => Math.hypot(o.x - point.x, o.y - point.y)))
}

/**
 * Finds a position for one blip that keeps it at least minDistance away from
 * every already-placed blip in the same ring+quadrant segment. Tries the
 * blip's own seeded random sequence first (keeps the existing scattered look
 * for sparse segments), then falls back to a deterministic grid scan so dense
 * segments still resolve without an unbounded search. If the segment is too
 * crowded for minDistance to be satisfiable at all, returns the least-bad
 * candidate seen instead of failing.
 */
function findPosition(
  rng: () => number,
  start: number,
  angleSpan: number,
  band: Band,
  placedInSegment: Point[],
  minDistance: number,
): Point {
  let bestPoint: Point | null = null
  let bestDistance = -Infinity

  const consider = (angle: number, radius: number): Point | null => {
    const point = polarToCartesian(angle, radius)
    const distance = closestDistance(point, placedInSegment)
    if (distance > bestDistance) {
      bestDistance = distance
      bestPoint = point
    }
    return distance >= minDistance ? point : null
  }

  for (let i = 0; i < MAX_RANDOM_ATTEMPTS; i++) {
    const { angle, radius } = randomAngleAndRadius(rng, start, angleSpan, band)
    const found = consider(angle, radius)
    if (found) return found
  }

  for (const { angle, radius } of gridCandidates(start, angleSpan, band, minDistance)) {
    const found = consider(angle, radius)
    if (found) return found
  }

  return bestPoint!
}

export function placeBlips(
  blips: Blip[],
  rings: Ring[],
  quadrants: Quadrant[],
  maxRadius: number,
): PlacedBlip[] {
  const bands = ringRadii(rings.length, maxRadius)
  const ringOrder = new Map(rings.map((r) => [r.id, r.order]))
  const result: PlacedBlip[] = []
  const placedBySegment = new Map<string, Point[]>()

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
      const segmentKey = `${q.id}:${blip.ring}`
      const placedInSegment = placedBySegment.get(segmentKey) ?? []

      const point = findPosition(rng, start, angleSpan, band, placedInSegment, MIN_BLIP_DISTANCE)
      placedBySegment.set(segmentKey, [...placedInSegment, point])
      result.push({ blip, x: point.x, y: point.y, number: i + 1 })
    })
  }

  return result
}
