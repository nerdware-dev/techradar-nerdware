import process from 'node:process'
import { slugify } from '../../src/data/slug'
import { ALIASES, SCOPE_ALIASES } from '../mappings/aliases'
import { QUADRANT_MAP } from '../mappings/quadrants'
import type { VerdictCache } from '../types'

/** One-shot: derive the seed verdict cache from today's allowlist + quadrant table.
 *  Run: `npx tsx scanner/scripts/seedVerdicts.ts > data/verdicts.json` */
const cache: VerdictCache = {}
for (const canonical of [...Object.values(ALIASES), ...Object.values(SCOPE_ALIASES)]) {
  const slug = slugify(canonical)
  const quadrant = QUADRANT_MAP[slug]
  cache[slug] = quadrant
    ? { verdict: 'radar', quadrant, source: 'seed' }
    : { verdict: 'radar', source: 'seed' }
}
const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)))
process.stdout.write(JSON.stringify(sorted, null, 2) + '\n')
