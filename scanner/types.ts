import type { RingId, QuadrantId } from '../src/data/types'

export type SignalKind = 'language' | 'dependency' | 'tool'

/** A raw signal found in one repo, before normalization. */
export interface DetectedToken {
  raw: string
  kind: SignalKind
  /** Strong quadrant signal from the detector (e.g. a language → languages-frameworks). */
  quadrantHint?: QuadrantId
}

/** The result of scanning a single repository. */
export interface RepoScan {
  repo: string
  /** ISO date (YYYY-MM-DD) the repo was last pushed to. */
  pushedAt: string
  tokens: DetectedToken[]
}

/** One technology aggregated across all repos. */
export interface Detection {
  /** Canonical blip name, e.g. "React". */
  name: string
  repoCount: number
  sourceRepos: string[]
  /** Most recent pushedAt across sourceRepos (ISO date). */
  lastSeen: string
  quadrantHint?: QuadrantId
}

/** A radar entry as stored on disk, including additive provenance fields. */
export interface ScannerBlip {
  name: string
  ring: RingId
  quadrant: QuadrantId
  isNew: boolean | string
  description?: string
  // machine-owned
  detected?: { repoCount: number; lastSeen: string; sourceRepos: string[] }
  autoRing?: RingId
  needsReview?: boolean
  // human-owned (scanner reads, never writes)
  ringOverride?: RingId
  quadrantOverride?: QuadrantId
  pinned?: boolean
  descriptionLocked?: boolean
  hidden?: boolean
  // allow unknown human fields to survive
  [key: string]: unknown
}
