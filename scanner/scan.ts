import { slugify } from '../src/data/slug'
import type { QuadrantId } from '../src/data/types'
import type { GitHubClient } from './github'
import type { LLMClient } from './llm/types'
import type { Detection, RepoScan, ScannerBlip, DetectedToken } from './types'
import { detectLanguages } from './detect/languages'
import { detectManifest, MANIFEST_FILES } from './detect/manifests'
import { detectTooling } from './detect/tooling'
import { aggregate } from './aggregate'
import { categorize } from './categorize'
import { draftDescription } from './describe'
import { mergeRadar } from './merge'
import { renderReport } from './report'

export interface ScanResult {
  candidate: ScannerBlip[]
  report: string
  detections: Detection[]
}

/** Optional progress sink (run.ts wires it to stderr; tests leave it silent). */
export type Logger = (message: string) => void
const noop: Logger = () => {}

/** Run the full pipeline against injected clients. Pure of file/network setup. */
export async function runScan(
  gh: GitHubClient,
  llm: LLMClient,
  existing: ScannerBlip[],
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

  const detections = aggregate(scans)
  const existingSlugs = new Set(existing.map((b) => slugify(b.name)))
  const newCount = detections.filter((d) => !existingSlugs.has(slugify(d.name))).length
  log(`Detected ${detections.length} techs (${newCount} new). Categorizing + drafting…`)

  const categorized = new Map<string, { quadrant: QuadrantId; needsReview: boolean }>()
  const descriptions = new Map<string, string>()
  let n = 0
  for (const detection of detections) {
    n += 1
    const slug = slugify(detection.name)
    log(`  (${n}/${detections.length}) ${detection.name}`)
    categorized.set(slug, await categorize(detection, llm))
    if (!existingSlugs.has(slug)) {
      descriptions.set(slug, await draftDescription(detection, llm))
    }
  }

  const { candidate, changes } = mergeRadar(existing, detections, categorized, descriptions)
  const report = renderReport(changes, repos.length)
  return { candidate, report, detections }
}
