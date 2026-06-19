import type { QuadrantId } from '../../src/data/types'
import type { DetectedToken } from '../types'

interface Rule {
  name: string
  quadrant: QuadrantId
  match: (path: string) => boolean
}

const base = (p: string) => p.split('/').pop() ?? p

const RULES: Rule[] = [
  { name: 'Docker', quadrant: 'platforms', match: (p) => /^Dockerfile/.test(base(p)) || base(p) === 'docker-compose.yml' },
  { name: 'Terraform', quadrant: 'platforms', match: (p) => p.endsWith('.tf') },
  { name: 'Kubernetes', quadrant: 'platforms', match: (p) => base(p) === 'Chart.yaml' || base(p) === 'kustomization.yaml' },
  { name: 'GitHub Actions', quadrant: 'platforms', match: (p) => p.startsWith('.github/workflows/') },
  { name: 'GitLab CI/CD', quadrant: 'platforms', match: (p) => base(p) === '.gitlab-ci.yml' },
  { name: 'Vite', quadrant: 'tools', match: (p) => /^vite\.config\.(t|j)s$/.test(base(p)) },
  { name: 'Playwright', quadrant: 'tools', match: (p) => /^playwright\.config\.(t|j)s$/.test(base(p)) },
]

/** Detect tools and easy platforms from the set of file paths in a repo. */
export function detectTooling(paths: string[]): DetectedToken[] {
  const tokens: DetectedToken[] = []
  for (const rule of RULES) {
    if (paths.some((p) => rule.match(p))) {
      tokens.push({ raw: rule.name, kind: 'tool', quadrantHint: rule.quadrant })
    }
  }
  return tokens
}
