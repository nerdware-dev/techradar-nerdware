import { z } from 'zod'
import DOMPurify from 'dompurify'
import type { Blip, Radar, RingId, QuadrantId } from './types'
import { slugify } from './slug'
import { RINGS, QUADRANTS, NEW_WINDOW_DAYS } from '../config'

const RING_IDS = RINGS.map((r) => r.id) as RingId[]
const QUADRANT_IDS = QUADRANTS.map((q) => q.id) as QuadrantId[]
const DAY_MS = 24 * 60 * 60 * 1000
const ISO_DATE = z.iso.date()

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
  /** Calendar date (YYYY-MM-DD, UTC) the entry was added to the radar; checked in readAddedAt. */
  addedAt: z.unknown().optional(),
  /** Scanner provenance; only the repo count is used by the app. */
  detected: z.object({ repoCount: z.number().int().nonnegative() }).optional(),
  description: z.string().optional().default(''),
})

type RawBlip = z.infer<typeof rawBlipSchema>

/**
 * The entry's addedAt, or undefined when it has none. Anything but a YYYY-MM-DD date throws
 * with the entry's name: the file is edited by hand and a bare schema error would not say
 * which of the entries is wrong.
 */
function readAddedAt(raw: RawBlip, index: number): string | undefined {
  if (raw.addedAt === undefined) return undefined
  const date = ISO_DATE.safeParse(raw.addedAt)
  if (!date.success) {
    throw new Error(
      `Blip "${raw.name}" (#${index}) has invalid addedAt ${JSON.stringify(raw.addedAt)}. Expected a date like 2026-10-01 (YYYY-MM-DD).`,
    )
  }
  return date.data
}

/** An entry without an addedAt date is never new. */
function isRecentlyAdded(addedAt: string | undefined, now: Date): boolean {
  if (!addedAt) return false
  const ageDays = Math.floor((now.getTime() - Date.parse(addedAt)) / DAY_MS)
  // a future date is a typo; counted as new, the entry would stay new until 90 days past it
  if (ageDays < 0) return false
  return ageDays < NEW_WINDOW_DAYS
}

function toBlip(raw: RawBlip, index: number, now: Date): Blip {
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
  return {
    id: slugify(raw.name),
    name: raw.name,
    ring: ring as RingId,
    quadrant: quadrant as QuadrantId,
    isNew: isRecentlyAdded(readAddedAt(raw, index), now),
    repoCount: raw.detected?.repoCount,
    description: sanitize(raw.description ?? ''),
  }
}

/** `now` decides which entries are still new; injectable for tests. */
export function parseRadar(raw: unknown, now: Date = new Date()): Radar {
  const entries = z.array(rawBlipSchema).parse(raw)
  const blips = entries.map((entry, index) => toBlip(entry, index, now))
  return { rings: RINGS, quadrants: QUADRANTS, blips }
}
