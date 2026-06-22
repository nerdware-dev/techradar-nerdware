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
  /** Resolved/triaged quadrant, authoritative; distinct from the detector quadrantHint. */
  quadrant?: QuadrantId
}

/** What a token is, for radar purposes. */
export type Verdict = 'radar' | 'child' | 'noise'
/** A verdict the cache can store (child is resolved to its parent at scan time). */
export type TerminalVerdict = 'radar' | 'noise'

/** Result of the deterministic per-token resolver (Task 6). */
export interface Resolved {
  /** Canonical blip name, e.g. "Radix UI". */
  canonical: string
  /** 'unknown' = no deterministic verdict; must go to LLM triage. */
  verdict: TerminalVerdict | 'unknown'
  /** Present when verdict is 'radar' and the quadrant is known deterministically. */
  quadrant?: QuadrantId
}

/** One entry in the persisted verdict cache (Task 4). */
export interface VerdictEntry {
  verdict: TerminalVerdict
  quadrant?: QuadrantId
  source: 'seed' | 'llm' | 'human'
  confidence?: number
  /** ISO date (YYYY-MM-DD) the verdict was decided. */
  decidedAt?: string
}

/** The persisted verdict cache, keyed by slugified canonical name. */
export type VerdictCache = Record<string, VerdictEntry>

/** Result of LLM triage for one unknown tech (Task 7). */
export interface TriageResult {
  verdict: Verdict
  /** Canonical parent name when verdict is 'child'. */
  parent?: string
  /** Present when verdict is 'radar'. */
  quadrant?: QuadrantId
  confidence: number
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
