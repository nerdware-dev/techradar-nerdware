import { slugify } from '../src/data/slug'
import { ALIASES, SCOPE_ALIASES } from './mappings/aliases'
import { IGNORE } from './mappings/ignore'
import type { DetectedToken } from './types'

export interface Classified {
  name: string
  /** true → radar-worthy (allowlisted dep, or a curated language/tool);
   *  false → a review candidate (unrecognized dependency). */
  notable: boolean
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

/** The `@scope` of a scoped npm package, lowercased (e.g. "@angular/core" → "@angular"). */
function npmScope(raw: string): string | null {
  if (!raw.startsWith('@')) return null
  const slash = raw.indexOf('/')
  return (slash === -1 ? raw : raw.slice(0, slash)).toLowerCase()
}

/** Classify a detected token into a canonical name + whether it belongs on the radar.
 *  Dependencies are radar-worthy only if on the alias allowlist (by `@scope` or exact
 *  name); unrecognized ones become review candidates (named but not published).
 *  `@types/*` stubs are dropped. Languages and tooling come from curated detectors and
 *  are always radar-worthy (alias-canonicalized so e.g. the "Vue" language and the
 *  "vue" package collapse to one blip), minus ignore-list noise. Returns null when ignored. */
export function classify(token: DetectedToken): Classified | null {
  const slug = slugify(token.raw)
  if (!slug || IGNORE.has(slug)) return null
  if (token.kind === 'dependency') {
    const scope = npmScope(token.raw)
    if (scope === '@types') return null // type stubs are never a radar technology
    if (scope && SCOPE_ALIASES[scope]) return { name: SCOPE_ALIASES[scope], notable: true }
    if (ALIASES[slug]) return { name: ALIASES[slug], notable: true }
    return { name: titleCase(slug), notable: false }
  }
  // language | tool — canonicalize via alias if known, else keep verbatim; always notable
  if (ALIASES[slug]) return { name: ALIASES[slug], notable: true }
  return { name: token.raw, notable: true }
}
