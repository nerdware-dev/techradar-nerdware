import { slugify } from '../../src/data/slug'

/** Exact slugs that are build/test plumbing, never a deliberate tech choice. */
const EXACT = new Set<string>([
  'tslib',
  'postcss',
  'autoprefixer',
  'reflect-metadata',
  'zone-js',
  'core-js',
  'regenerator-runtime',
  'ts-node',
  'tsx',
  'globals',
  'source-map-support',
  'rimraf',
  'husky',
  'lint-staged',
  'nodemon',
  'concurrently',
  'cross-env',
  'copyfiles',
])

/** Raw-token prefixes (scoped plumbing namespaces). */
const RAW_PREFIXES = ['@types/', '@swc/', '@babel/', 'babel-']

/** Slug patterns for plumbing families. */
const SLUG_PATTERNS = [/^eslint-plugin-/, /^eslint-config-/, /-loader$/, /-webpack-plugin$/]

/** True when a token is build/lint/test plumbing rather than a radar technology. */
export function isPlumbing(raw: string): boolean {
  const lower = raw.toLowerCase()
  if (RAW_PREFIXES.some((p) => lower.startsWith(p))) return true
  const slug = slugify(raw)
  if (EXACT.has(slug)) return true
  return SLUG_PATTERNS.some((re) => re.test(slug))
}
