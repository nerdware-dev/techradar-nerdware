import type { QuadrantId } from '../../src/data/types'
import type { TriageResult } from '../types'
import { QUADRANTS } from '../../src/config'

const QUADRANT_IDS = QUADRANTS.map((q) => q.id) as QuadrantId[]
// Annotated as QuadrantId[] so .includes(QuadrantId) type-checks (TS 6 would
// otherwise narrow the filtered element type to exclude 'techniques').
const DETECTABLE: QuadrantId[] = QUADRANT_IDS.filter((q) => q !== 'techniques')

/** Build the German description-drafting prompt for a new tech. */
export function describePrompt(name: string, context: string): string {
  return (
    `Schreibe eine sachliche deutsche Kurzbeschreibung (2-4 Sätze) der Technologie "${name}" ` +
    `für einen Tech-Radar. Kontext: ${context} Antworte nur mit der Beschreibung, ohne Vorrede.`
  )
}

/** Build the relevance-triage prompt with the architecture-stance rubric. */
export function triagePrompt(name: string, context: string): string {
  return (
    `You curate a tech radar. A radar tracks technologies a team deliberately CHOOSES ` +
    `and has an opinion on — frameworks, ORMs, databases, platforms, state management, ` +
    `auth, testing frameworks, AI/ML SDKs, significant libraries. It does NOT track ` +
    `transitive dependencies, build/lint plumbing, polyfills, type stubs, or micro-utilities ` +
    `(date formatting, classname helpers, UUID generation).\n` +
    `Classify the dependency "${name}". ${context}\n` +
    `Allowed quadrants: ${DETECTABLE.join(', ')}.\n` +
    `Reply with ONLY JSON: {"verdict":"radar"|"child"|"noise","parent":<name|null>,` +
    `"quadrant":"<id|null>","confidence":<0..1>}. Use "child" only if it is a sub-package ` +
    `of a larger product; put that product in "parent".`
  )
}

/** Parse triage JSON, clamping unknown verdicts to noise and unknown quadrants to tools. */
export function parseTriage(text: string): TriageResult {
  try {
    const p = JSON.parse(text) as {
      verdict?: string
      parent?: string
      quadrant?: string
      confidence?: number
    }
    const verdict = p.verdict === 'radar' || p.verdict === 'child' ? p.verdict : 'noise'
    const confidence = typeof p.confidence === 'number' ? p.confidence : 0
    const quadrant = DETECTABLE.includes(p.quadrant as QuadrantId)
      ? (p.quadrant as QuadrantId)
      : undefined
    const result: TriageResult = { verdict, confidence }
    if (verdict === 'radar') result.quadrant = quadrant ?? 'tools'
    if (verdict === 'child' && p.parent) result.parent = p.parent
    return result
  } catch {
    return { verdict: 'noise', confidence: 0 }
  }
}
