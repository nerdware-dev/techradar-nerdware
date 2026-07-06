import type { Detection } from './types'

/** Concrete detected tech (canonical blip name) → abstract blip(s) it implies. */
export const IMPLICATIONS: Record<string, string[]> = {
  AWS: ['Cloud Networking'],
  Azure: ['Cloud Networking'],
  Terraform: ['Infrastructure as Code'],
  Pulumi: ['Infrastructure as Code'],
  Terragrunt: ['Infrastructure as Code'],
  Crossplane: ['Infrastructure as Code'],
  'GitHub Actions': ['CI/CD'],
  'GitLab CI/CD': ['CI/CD'],
  'Apache Kafka': ['Message Queues'],
}

/** Append derived detections for abstract blips implied by detected concrete tech.
 *  Pure: clones input; never mutates the passed detections. */
export function deriveImplied(detections: Detection[]): Detection[] {
  const result: Detection[] = detections.map((d) => ({ ...d, sourceRepos: [...d.sourceRepos] }))
  const byName = new Map(result.map((d) => [d.name, d]))
  const derived = new Map<string, { repos: Set<string>; lastSeen: string }>()

  for (const source of detections) {
    const targets = IMPLICATIONS[source.name]
    if (!targets) continue
    for (const target of targets) {
      const real = byName.get(target)
      if (real && !real.derived) {
        // Target already detected directly: fold in the source's repos as evidence.
        for (const r of source.sourceRepos) {
          if (!real.sourceRepos.includes(r)) real.sourceRepos.push(r)
        }
        real.repoCount = real.sourceRepos.length
        if (source.lastSeen > real.lastSeen) real.lastSeen = source.lastSeen
        continue
      }
      const acc = derived.get(target) ?? { repos: new Set<string>(), lastSeen: '' }
      for (const r of source.sourceRepos) acc.repos.add(r)
      if (source.lastSeen > acc.lastSeen) acc.lastSeen = source.lastSeen
      derived.set(target, acc)
    }
  }

  for (const [name, acc] of derived) {
    const repos = [...acc.repos]
    result.push({
      name,
      repoCount: repos.length,
      sourceRepos: repos,
      lastSeen: acc.lastSeen,
      derived: true,
    })
  }
  return result
}
