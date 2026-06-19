import type { Detection } from './types'
import type { LLMClient } from './llm/types'

/** Ask the LLM to draft a German radar description for a newly-detected tech. */
export function draftDescription(detection: Detection, llm: LLMClient): Promise<string> {
  const context = `Erkannt in ${detection.repoCount} Repositories: ${detection.sourceRepos.join(', ')}.`
  return llm.describe(detection.name, context)
}
