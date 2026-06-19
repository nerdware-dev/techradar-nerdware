import type { QuadrantId } from '../src/data/types'
import { slugify } from '../src/data/slug'
import { QUADRANT_MAP } from './mappings/quadrants'
import type { Detection } from './types'
import type { LLMClient } from './llm/types'

export const CONFIDENCE_THRESHOLD = 0.7

/** Resolve a detection's quadrant: detector hint → static table → LLM fallback.
 *  Low-confidence LLM results are flagged needsReview (held back from publish). */
export async function categorize(
  detection: Detection,
  llm: LLMClient,
): Promise<{ quadrant: QuadrantId; needsReview: boolean }> {
  if (detection.quadrantHint) {
    return { quadrant: detection.quadrantHint, needsReview: false }
  }
  const mapped = QUADRANT_MAP[slugify(detection.name)]
  if (mapped) {
    return { quadrant: mapped, needsReview: false }
  }
  const context = `Used in ${detection.repoCount} repositories: ${detection.sourceRepos.join(', ')}`
  const { quadrant, confidence } = await llm.categorize(detection.name, context)
  return { quadrant, needsReview: confidence < CONFIDENCE_THRESHOLD }
}
