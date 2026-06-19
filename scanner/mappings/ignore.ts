/** Slugs of tokens that are noise, not radar-worthy technologies.
 *  Covers build/markup languages GitHub reports and config-only languages. */
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
  // config / template / diagram languages that aren't radar technologies
  'plpgsql',
  'mermaid',
  'hcl', // Terraform's config language — Terraform itself is detected via *.tf
  'smarty',
])
