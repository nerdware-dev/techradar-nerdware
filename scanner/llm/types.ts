import type { QuadrantId } from '../../src/data/types'
import type { TriageResult } from '../types'

export interface LLMClient {
  /** Classify a tech into a quadrant with a 0..1 confidence. */
  categorize(name: string, context: string): Promise<{ quadrant: QuadrantId; confidence: number }>
  /** Draft a German radar description for a new tech. */
  describe(name: string, context: string): Promise<string>
  /** Decide whether an unrecognized dep is radar-worthy, a child of a parent, or noise. */
  triage(name: string, context: string): Promise<TriageResult>
}

/** The model aliases a provider uses for each call type. */
export interface ModelPair {
  categorize: string
  describe: string
  triage: string
}
