import { slugify } from '../src/data/slug'
import { ALIASES } from './mappings/aliases'
import { IGNORE } from './mappings/ignore'

/** Convert a raw detected token to its canonical blip name.
 *  Returns null when the token is ignored noise. */
export function normalize(raw: string): string | null {
  const slug = slugify(raw)
  if (!slug || IGNORE.has(slug)) return null
  if (ALIASES[slug]) return ALIASES[slug]
  // Best-effort: title-case a single-word token; leave multi-word tokens joined.
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
