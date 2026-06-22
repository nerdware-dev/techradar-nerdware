import { slugify } from '../src/data/slug'
import { ALIASES } from './mappings/aliases'
import { IGNORE } from './mappings/ignore'
import { collapseFamily } from './mappings/families'
import { isPlumbing } from './mappings/plumbing'
import { lookupVerdict } from './verdicts'
import type { DetectedToken, Resolved, VerdictCache } from './types'

function titleCase(slug: string): string {
  return slug.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

/** Stage the relevance decision cheapest-first. Returns null for hard-drops. */
export function resolve(token: DetectedToken, cache: VerdictCache): Resolved | null {
  const slug = slugify(token.raw)
  if (!slug || IGNORE.has(slug)) return null

  if (token.kind !== 'dependency') {
    // language | tool — curated detector signals are always radar.
    const canonical = ALIASES[slug] ?? token.raw
    return { canonical, verdict: 'radar', quadrant: token.quadrantHint }
  }

  if (token.raw.toLowerCase().startsWith('@types/')) return null

  const family = collapseFamily(token.raw)
  if (family) return { canonical: family.canonical, verdict: family.verdict, quadrant: family.quadrant }

  if (isPlumbing(token.raw)) return { canonical: titleCase(slug), verdict: 'noise' }

  const canonical = ALIASES[slug] ?? titleCase(slug)
  const cached = lookupVerdict(canonical, cache)
  if (cached) return { canonical, verdict: cached.verdict, quadrant: cached.quadrant }

  return { canonical, verdict: 'unknown' }
}
