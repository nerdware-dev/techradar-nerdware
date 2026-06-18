import { z } from 'zod'
import DOMPurify from 'dompurify'
import type { Blip, Radar, RingId, QuadrantId } from './types'
import { slugify } from './slug'
import { RINGS, QUADRANTS } from '../config'

const TRUTHY = new Set(['true', '1', 'yes'])

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong', 'br', 'p'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })
}

const rawBlipSchema = z.object({
  name: z.string().min(1),
  ring: z.string().min(1),
  quadrant: z.string().min(1),
  isNew: z.union([z.string(), z.boolean()]).optional(),
  description: z.string().optional().default(''),
})

function toBlip(raw: z.infer<typeof rawBlipSchema>, index: number): Blip {
  const RING_IDS = RINGS.map((r) => r.id) as RingId[]
  const QUADRANT_IDS = QUADRANTS.map((q) => q.id) as QuadrantId[]

  const ring = slugify(raw.ring)
  if (!RING_IDS.includes(ring as RingId)) {
    throw new Error(`Blip "${raw.name}" (#${index}) has unknown ring "${raw.ring}". Allowed: ${RING_IDS.join(', ')}`)
  }
  const quadrant = slugify(raw.quadrant)
  if (!QUADRANT_IDS.includes(quadrant as QuadrantId)) {
    throw new Error(
      `Blip "${raw.name}" (#${index}) has unknown quadrant "${raw.quadrant}". Allowed: ${QUADRANT_IDS.join(', ')}`,
    )
  }
  const isNew = typeof raw.isNew === 'boolean' ? raw.isNew : TRUTHY.has(String(raw.isNew ?? '').toLowerCase())
  return {
    id: slugify(raw.name),
    name: raw.name,
    ring: ring as RingId,
    quadrant: quadrant as QuadrantId,
    isNew,
    description: sanitize(raw.description ?? ''),
  }
}

export function parseRadar(raw: unknown): Radar {
  const entries = z.array(rawBlipSchema).parse(raw)
  const blips = entries.map(toBlip)
  return { rings: RINGS, quadrants: QUADRANTS, blips }
}
