import { slugify } from '../src/data/slug'
import type { Detection, TriageResult } from './types'
import type { LLMClient } from './llm/types'

/** Triage each unknown detection via the LLM. One call per unknown; keyed by slug. */
export async function triageAll(
  unknowns: Detection[],
  llm: LLMClient,
): Promise<Map<string, TriageResult>> {
  const out = new Map<string, TriageResult>()
  for (const d of unknowns) {
    const context = `Used in ${d.repoCount} repositories: ${d.sourceRepos.join(', ')}.`
    out.set(slugify(d.name), await llm.triage(d.name, context))
  }
  return out
}
