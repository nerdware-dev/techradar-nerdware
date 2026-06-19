import type { RingId, QuadrantId } from '../src/data/types'
import { slugify } from '../src/data/slug'
import { autoRing } from './autoRing'
import type { Detection, ScannerBlip } from './types'

export interface ChangeSet {
  added: string[]
  ringMoves: { name: string; from: RingId; to: RingId }[]
  undetected: string[]
  needsReview: string[]
}

/** Combine machine detections with the existing radar, preserving all human-owned
 *  fields. New techs are added; detected existing blips are re-ringed to autoRing
 *  (unless a ringOverride is set); undetected existing blips are left untouched. */
export function mergeRadar(
  existing: ScannerBlip[],
  detections: Detection[],
  categorized: Map<string, { quadrant: QuadrantId; needsReview: boolean }>,
  descriptions: Map<string, string>,
): { candidate: ScannerBlip[]; changes: ChangeSet } {
  const changes: ChangeSet = { added: [], ringMoves: [], undetected: [], needsReview: [] }
  const detectionBySlug = new Map(detections.map((d) => [slugify(d.name), d]))
  const candidate: ScannerBlip[] = []

  // 1. Update / preserve existing blips.
  for (const blip of existing) {
    const slug = slugify(blip.name)
    const detection = detectionBySlug.get(slug)
    const next: ScannerBlip = { ...blip }
    if (detection) {
      const ar = autoRing(detection.repoCount)
      next.autoRing = ar
      next.detected = {
        repoCount: detection.repoCount,
        lastSeen: detection.lastSeen,
        sourceRepos: detection.sourceRepos,
      }
      const effectiveRing = next.ringOverride ?? ar
      if (effectiveRing !== blip.ring) {
        changes.ringMoves.push({ name: blip.name, from: blip.ring as RingId, to: effectiveRing })
      }
      next.ring = effectiveRing
    } else {
      changes.undetected.push(blip.name)
    }
    candidate.push(next)
  }

  // 2. Add newly-detected techs not already present.
  const existingSlugs = new Set(existing.map((b) => slugify(b.name)))
  for (const detection of detections) {
    const slug = slugify(detection.name)
    if (existingSlugs.has(slug)) continue
    const cat = categorized.get(slug)
    const ar = autoRing(detection.repoCount)
    const blip: ScannerBlip = {
      name: detection.name,
      ring: ar,
      quadrant: cat?.quadrant ?? 'tools',
      isNew: true,
      description: descriptions.get(slug) ?? '',
      autoRing: ar,
      detected: {
        repoCount: detection.repoCount,
        lastSeen: detection.lastSeen,
        sourceRepos: detection.sourceRepos,
      },
    }
    if (cat?.needsReview) {
      blip.needsReview = true
      changes.needsReview.push(detection.name)
    }
    candidate.push(blip)
    changes.added.push(detection.name)
  }

  return { candidate, changes }
}
