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

/** Run the full pipeline against injected clients. Pure of file/network setup. */
export async function runScan(
  gh: GitHubClient,
  llm: LLMClient,
  existing: ScannerBlip[],
): Promise<ScanResult> {
  const repos = await gh.listRepos()
  const scans: RepoScan[] = []

  for (const repo of repos) {
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

  const categorized = new Map<string, { quadrant: QuadrantId; needsReview: boolean }>()
  const descriptions = new Map<string, string>()
  for (const detection of detections) {
    const slug = slugify(detection.name)
    categorized.set(slug, await categorize(detection, llm))
    if (!existingSlugs.has(slug)) {
      descriptions.set(slug, await draftDescription(detection, llm))
    }
  }

  const { candidate, changes } = mergeRadar(existing, detections, categorized, descriptions)
  const report = renderReport(changes, repos.length)
  return { candidate, report, detections }
}
