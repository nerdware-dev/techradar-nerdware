import { slugify } from '../src/data/slug'
import type { QuadrantId } from '../src/data/types'
import type { GitHubClient } from './github'
import type { LLMClient } from './llm/types'
import type { Detection, RepoScan, ScannerBlip, DetectedToken, VerdictCache } from './types'
import { detectLanguages } from './detect/languages'
import { detectManifest, MANIFEST_FILES } from './detect/manifests'
import { detectTooling } from './detect/tooling'
import { aggregate } from './aggregate'
import { triageAll } from './triage'
import { mergeVerdicts } from './verdicts'
import { draftDescription } from './describe'
import { mergeRadar } from './merge'
import { renderReport } from './report'

const CONFIDENCE_THRESHOLD = 0.7

export interface ScanResult {
  candidate: ScannerBlip[]
  report: string
  detections: Detection[]
  /** Noise, for the audit log (not published). */
  suppressed: Detection[]
  /** Verdict cache merged with this scan's LLM verdicts, for run.ts to persist. */
  verdicts: VerdictCache
}

/** Optional progress sink (run.ts wires it to stderr; tests leave it silent). */
export type Logger = (message: string) => void
const noop: Logger = () => {}

/** Run the full pipeline against injected clients. Pure of file/network setup. */
export async function runScan(
  gh: GitHubClient,
  llm: LLMClient,
  existing: ScannerBlip[],
  cache: VerdictCache,
  today: string,
  log: Logger = noop,
): Promise<ScanResult> {
  log('Listing org repos…')
  const repos = await gh.listRepos()
  log(`Found ${repos.length} repos to scan.`)
  const scans: RepoScan[] = []

  let i = 0
  for (const repo of repos) {
    i += 1
    log(`[${i}/${repos.length}] ${repo.name}`)
    const tokens: DetectedToken[] = []
    const languages = await gh.getLanguages(repo.name).catch(() => ({}))
    tokens.push(...detectLanguages(languages))

    const files = await gh.listFiles(repo.name, repo.defaultBranch).catch(() => [] as string[])
    tokens.push(...detectTooling(files))

    for (const path of files) {
      const file = path.split('/').pop() ?? path
      if (!MANIFEST_FILES.includes(file)) continue
      const content = await gh.getFileContent(repo.name, path)
      if (content) tokens.push(...detectManifest(path, content))
    }
    scans.push({ repo: repo.name, pushedAt: repo.pushedAt, tokens })
  }

  const { detections, unknowns, suppressed } = aggregate(scans, cache)
  log(
    `Detected ${detections.length} radar techs + ${unknowns.length} unknown, ${suppressed.length} suppressed. Triaging…`,
  )

  const categorized = new Map<string, { quadrant: QuadrantId; needsReview: boolean }>()
  for (const d of detections) {
    categorized.set(slugify(d.name), { quadrant: d.quadrant ?? 'tools', needsReview: false })
  }

  const triaged = await triageAll(unknowns, llm)
  const patch: VerdictCache = {}
  for (const u of unknowns) {
    const slug = slugify(u.name)
    const t = triaged.get(slug)!
    if (t.verdict === 'radar') {
      const resolvedQuadrant = t.quadrant ?? 'tools'
      u.quadrant = resolvedQuadrant
      detections.push(u)
      categorized.set(slug, {
        quadrant: resolvedQuadrant,
        needsReview: t.confidence < CONFIDENCE_THRESHOLD,
      })
      patch[slug] = {
        verdict: 'radar',
        quadrant: resolvedQuadrant,
        source: 'llm',
        confidence: t.confidence,
        decidedAt: today,
      }
    } else {
      if (t.verdict === 'child' && t.parent) {
        const parent = detections.find((d) => slugify(d.name) === slugify(t.parent!))
        if (parent) {
          for (const repo of u.sourceRepos) {
            if (!parent.sourceRepos.includes(repo)) {
              parent.sourceRepos.push(repo)
              parent.repoCount += 1
            }
          }
          if (u.lastSeen > parent.lastSeen) parent.lastSeen = u.lastSeen
        } else suppressed.push(u) // child whose parent was never detected is intentionally suppressed and cached as noise
      } else suppressed.push(u)
      patch[slug] = { verdict: 'noise', source: 'llm', confidence: t.confidence, decidedAt: today }
    }
  }

  const existingSlugs = new Set(existing.map((b) => slugify(b.name)))
  const descriptions = new Map<string, string>()
  for (const d of detections) {
    const slug = slugify(d.name)
    if (!existingSlugs.has(slug)) descriptions.set(slug, await draftDescription(d, llm))
  }

  const { candidate, changes } = mergeRadar(existing, detections, categorized, descriptions)
  const report = renderReport(changes, repos.length, suppressed.length)
  return { candidate, report, detections, suppressed, verdicts: mergeVerdicts(cache, patch) }
}
