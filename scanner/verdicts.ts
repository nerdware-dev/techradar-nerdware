import { slugify } from '../src/data/slug'
import type { VerdictCache, VerdictEntry } from './types'

/** Look up a verdict by canonical name (slug-keyed). */
export function lookupVerdict(canonical: string, cache: VerdictCache): VerdictEntry | undefined {
  return cache[slugify(canonical)]
}

/** Merge LLM/seed verdicts into the cache without clobbering human decisions. */
export function mergeVerdicts(cache: VerdictCache, patch: VerdictCache): VerdictCache {
  const next: VerdictCache = { ...cache }
  for (const [key, entry] of Object.entries(patch)) {
    if (next[key]?.source === 'human') continue
    next[key] = entry
  }
  return next
}
