import type { QuadrantId } from '../../src/data/types'

export interface LLMClient {
  /** Classify a tech into a quadrant with a 0..1 confidence. */
  categorize(name: string, context: string): Promise<{ quadrant: QuadrantId; confidence: number }>
  /** Draft a German radar description for a new tech. */
  describe(name: string, context: string): Promise<string>
}

/** The model aliases a provider uses for each call type. */
export interface ModelPair {
  categorize: string
  describe: string
}
