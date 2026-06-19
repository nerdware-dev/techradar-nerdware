import { describe, it, expect } from 'vitest'
import { mergeRadar } from './merge'
import type { Detection, ScannerBlip } from './types'
import type { RingId } from '../src/data/types'
import { slugify } from '../src/data/slug'

const existing: ScannerBlip[] = [
  { name: 'AWS', ring: 'high', quadrant: 'platforms', isNew: 'FALSE', description: 'Cloud.' },
  {
    name: 'React',
    ring: 'low',
    quadrant: 'languages-frameworks',
    isNew: 'FALSE',
    description: 'UI lib.',
  },
  {
    name: 'Scrum',
    ring: 'high',
    quadrant: 'techniques',
    isNew: 'FALSE',
    description: 'Method.',
    pinned: true,
  },
]

// React detected widely; a brand-new tech "Grafana"; AWS and Scrum NOT detected.
const detections: Detection[] = [
  {
    name: 'React',
    repoCount: 6,
    sourceRepos: ['a', 'b', 'c', 'd', 'e', 'f'],
    lastSeen: '2026-06-18',
  },
  { name: 'Grafana', repoCount: 1, sourceRepos: ['a'], lastSeen: '2026-06-10' },
]
const categorized = new Map([
  [slugify('React'), { quadrant: 'languages-frameworks' as const, needsReview: false }],
  [slugify('Grafana'), { quadrant: 'tools' as const, needsReview: false }],
])
const descriptions = new Map([[slugify('Grafana'), 'Grafana ist ein Dashboard-Tool.']])

describe('mergeRadar', () => {
  const { candidate, changes } = mergeRadar(existing, detections, categorized, descriptions)
  const byName = (n: string) => candidate.find((b) => b.name === n)!

  it('adds a new blip with detection data, autoRing, quadrant and German description', () => {
    const g = byName('Grafana')
    expect(g.isNew).toBe(true)
    expect(g.autoRing).toBe('low')
    expect(g.quadrant).toBe('tools')
    expect(g.description).toBe('Grafana ist ein Dashboard-Tool.')
    expect(g.detected?.repoCount).toBe(1)
    expect(changes.added).toContain('Grafana')
  })

  it('reconciles a detected existing blip ring to autoRing and records the move', () => {
    expect(byName('React').ring).toBe('high') // 6 repos → high, was low
    expect(changes.ringMoves).toContainEqual({ name: 'React', from: 'low', to: 'high' })
  })

  it('does not record a phantom move when display-cased ring matches autoRing', () => {
    // Existing entries store rings capitalized ("High"); a detection mapping back
    // to the same ring must not register as a move, and casing is preserved.
    const capitalized: ScannerBlip[] = [
      // 'High' mirrors the display casing stored on disk (run.ts casts the raw JSON).
      {
        name: 'React',
        ring: 'High' as RingId,
        quadrant: 'languages-frameworks',
        isNew: 'FALSE',
        description: 'x',
      },
    ]
    const { candidate: c, changes: ch } = mergeRadar(
      capitalized,
      detections,
      categorized,
      descriptions,
    )
    expect(ch.ringMoves).toHaveLength(0)
    expect(c.find((b) => b.name === 'React')!.ring).toBe('High')
  })

  it('never overwrites an existing human description', () => {
    expect(byName('React').description).toBe('UI lib.')
  })

  it('keeps an undetected existing blip unchanged and lists it for review', () => {
    expect(byName('AWS').ring).toBe('high')
    expect(byName('AWS').detected).toBeUndefined()
    expect(changes.undetected).toContain('AWS')
  })

  it('never drops a pinned curated blip and never auto-retires it', () => {
    expect(byName('Scrum')).toBeTruthy()
    expect(byName('Scrum').ring).toBe('high')
  })

  it('does not auto-promote an entry deliberately at Out; flags it as reactivated', () => {
    const retired: ScannerBlip[] = [
      {
        name: 'PHP',
        ring: 'Out' as RingId,
        quadrant: 'languages-frameworks',
        isNew: 'FALSE',
        description: 'x',
      },
    ]
    const detected: Detection[] = [
      { name: 'PHP', repoCount: 3, sourceRepos: ['a', 'b', 'c'], lastSeen: '2026-06-18' },
    ]
    const { candidate: c, changes: ch } = mergeRadar(retired, detected, categorized, descriptions)
    const php = c.find((b) => b.name === 'PHP')!
    expect(php.ring).toBe('Out') // stays out despite 3-repo adoption
    expect(php.detected?.repoCount).toBe(3) // detection data still recorded
    expect(ch.reactivated).toContain('PHP')
    expect(ch.ringMoves.find((m) => m.name === 'PHP')).toBeUndefined()
  })

  it('honors a ringOverride instead of autoRing', () => {
    const withOverride: ScannerBlip[] = [
      {
        name: 'React',
        ring: 'dev',
        quadrant: 'languages-frameworks',
        isNew: 'FALSE',
        description: 'x',
        ringOverride: 'dev',
      },
    ]
    const { candidate: c } = mergeRadar(withOverride, detections, categorized, descriptions)
    expect(c.find((b) => b.name === 'React')!.ring).toBe('dev')
  })
})
