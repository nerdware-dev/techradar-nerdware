/** Slugs of tokens that are noise, not radar-worthy technologies. */
export const IGNORE = new Set<string>([
  'types-node',
  'eslint-config-prettier',
  'html',
  'css',
  'scss',
  'shell',
  'dockerfile',
  'makefile',
  'roff',
])
