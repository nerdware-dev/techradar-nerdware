import { slugify } from '../src/data/slug'
import { ALIASES } from './mappings/aliases'
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

/** Classify a detected token into a canonical name + whether it belongs on the radar.
 *  Dependencies are radar-worthy only if on the alias allowlist; unrecognized ones
 *  become review candidates (named but not published). Languages and tooling come
 *  from curated detectors and are always radar-worthy, minus ignore-list noise
 *  (HTML/CSS/Shell/Dockerfile/etc.). Returns null for ignored tokens. */
export function classify(token: DetectedToken): Classified | null {
  const slug = slugify(token.raw)
  if (!slug || IGNORE.has(slug)) return null
  if (token.kind === 'dependency') {
    if (ALIASES[slug]) return { name: ALIASES[slug], notable: true }
    return { name: titleCase(slug), notable: false }
  }
  return { name: token.raw, notable: true }
}
