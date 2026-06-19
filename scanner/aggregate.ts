import { classify } from './classify'
import type { Detection, RepoScan } from './types'

export interface Aggregated {
  /** Radar-worthy techs (allowlisted deps, languages, tooling). */
  detections: Detection[]
  /** Unrecognized dependencies, sorted by adoption — a review list, not published. */
  candidates: Detection[]
}

/** Collapse per-repo tokens into per-tech records, split into radar detections
 *  (notable) and review candidates (unrecognized deps). Deduped by canonical name. */
export function aggregate(scans: RepoScan[]): Aggregated {
  const notable = new Map<string, Detection>()
  const candidates = new Map<string, Detection>()

  for (const scan of scans) {
    // A repo counts once per tech even if it lists the tech in several tokens.
    const seenInRepo = new Set<string>()
    for (const token of scan.tokens) {
      const c = classify(token)
      if (!c || seenInRepo.has(c.name)) continue
      seenInRepo.add(c.name)
      const bucket = c.notable ? notable : candidates
      const existing = bucket.get(c.name)
      if (existing) {
        existing.repoCount += 1
        existing.sourceRepos.push(scan.repo)
        if (scan.pushedAt > existing.lastSeen) existing.lastSeen = scan.pushedAt
        if (!existing.quadrantHint && token.quadrantHint) existing.quadrantHint = token.quadrantHint
      } else {
        bucket.set(c.name, {
          name: c.name,
          repoCount: 1,
          sourceRepos: [scan.repo],
          lastSeen: scan.pushedAt,
          quadrantHint: token.quadrantHint,
        })
      }
    }
  }

  const byAdoption = (a: Detection, b: Detection) => b.repoCount - a.repoCount
  return {
    detections: [...notable.values()],
    candidates: [...candidates.values()].sort(byAdoption),
  }
}
