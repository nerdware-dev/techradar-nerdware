import { normalize } from './normalize'
import type { Detection, RepoScan } from './types'

/** Collapse per-repo tokens into per-tech detections (deduped by canonical name). */
export function aggregate(scans: RepoScan[]): Detection[] {
  const byName = new Map<string, Detection>()
  for (const scan of scans) {
    // A repo counts once per tech even if it lists the tech in several tokens.
    const seenInRepo = new Set<string>()
    for (const token of scan.tokens) {
      const name = normalize(token.raw)
      if (!name || seenInRepo.has(name)) continue
      seenInRepo.add(name)
      const existing = byName.get(name)
      if (existing) {
        existing.repoCount += 1
        existing.sourceRepos.push(scan.repo)
        if (scan.pushedAt > existing.lastSeen) existing.lastSeen = scan.pushedAt
        if (!existing.quadrantHint && token.quadrantHint) existing.quadrantHint = token.quadrantHint
      } else {
        byName.set(name, {
          name,
          repoCount: 1,
          sourceRepos: [scan.repo],
          lastSeen: scan.pushedAt,
          quadrantHint: token.quadrantHint,
        })
      }
    }
  }
  return [...byName.values()]
}
