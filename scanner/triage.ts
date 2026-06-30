import { slugify } from '../src/data/slug'
import type { Detection, TriageResult } from './types'
import type { LLMClient } from './llm/types'

/** Triage each unknown detection via the LLM. One call per unknown; keyed by slug.
 *  Runs with bounded concurrency (default 8) to speed up cold-cache runs. */
export async function triageAll(
  unknowns: Detection[],
  llm: LLMClient,
  concurrency = 8,
): Promise<Map<string, TriageResult>> {
  const out = new Map<string, TriageResult>()
  let i = 0
  async function worker() {
    while (i < unknowns.length) {
      const d = unknowns[i++]
      const context = `Used in ${d.repoCount} repositories: ${d.sourceRepos.join(', ')}.`
      out.set(slugify(d.name), await llm.triage(d.name, context))
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, unknowns.length || 1) }, () => worker()),
  )
  return out
}
