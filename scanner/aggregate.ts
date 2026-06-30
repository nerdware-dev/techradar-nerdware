import { resolve } from './resolve'
import type { Detection, RepoScan, VerdictCache } from './types'

export interface Aggregated {
  /** Radar-worthy techs (deterministic/cached), each with a resolved quadrant. */
  detections: Detection[]
  /** Cache-miss deps awaiting LLM triage. */
  unknowns: Detection[]
  /** Noise (transitive/plumbing/family-noise), sorted by adoption — audit only. */
  suppressed: Detection[]
}

/** Collapse per-repo tokens into per-canonical records, split by verdict. */
export function aggregate(scans: RepoScan[], cache: VerdictCache): Aggregated {
  const buckets = {
    radar: new Map<string, Detection>(),
    unknown: new Map<string, Detection>(),
    noise: new Map<string, Detection>(),
  }

  for (const scan of scans) {
    const seenInRepo = new Set<string>()
    for (const token of scan.tokens) {
      const r = resolve(token, cache)
      if (!r || seenInRepo.has(r.canonical)) continue
      seenInRepo.add(r.canonical)
      const bucket =
        r.verdict === 'radar'
          ? buckets.radar
          : r.verdict === 'noise'
            ? buckets.noise
            : buckets.unknown
      const existing = bucket.get(r.canonical)
      if (existing) {
        existing.repoCount += 1
        existing.sourceRepos.push(scan.repo)
        if (scan.pushedAt > existing.lastSeen) existing.lastSeen = scan.pushedAt
        if (!existing.quadrant && r.quadrant) existing.quadrant = r.quadrant
      } else {
        bucket.set(r.canonical, {
          name: r.canonical,
          repoCount: 1,
          sourceRepos: [scan.repo],
          lastSeen: scan.pushedAt,
          quadrant: r.quadrant,
        })
      }
    }
  }

  const byAdoption = (a: Detection, b: Detection) => b.repoCount - a.repoCount
  return {
    detections: [...buckets.radar.values()],
    unknowns: [...buckets.unknown.values()].sort(byAdoption),
    suppressed: [...buckets.noise.values()].sort(byAdoption),
  }
}
