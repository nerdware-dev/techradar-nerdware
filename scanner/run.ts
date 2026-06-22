import './dom-bootstrap' // must precede any import that pulls in DOMPurify (parseRadar)
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { Octokit } from '@octokit/rest'
import { parseRadar } from '../src/data/schema'
import { slugify } from '../src/data/slug'
import { SCANNER_CONFIG } from './config'
import { createGitHubClient } from './github'
import { createLLMClient } from './llm/createLLMClient'
import { runScan } from './scan'
import type { ScannerBlip } from './types'

async function main(): Promise<void> {
  // Load .env locally (gitignored); in CI the vars come from the environment.
  if (existsSync('.env')) process.loadEnvFile('.env')

  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
  if (!token) throw new Error('Set GH_TOKEN (e.g. GH_TOKEN=$(gh auth token)).')

  // Per-request timeout so a stalled GitHub call fails fast instead of hanging forever.
  const timedFetch: typeof fetch = (url, init) =>
    fetch(url, { ...init, signal: AbortSignal.timeout(20_000) })
  const gh = createGitHubClient(
    new Octokit({ auth: token, request: { fetch: timedFetch } }),
    SCANNER_CONFIG.org,
  )
  const llm = createLLMClient() // Forge gateway; validates FORGE_API_KEY

  const existingRaw = JSON.parse(
    await readFile(SCANNER_CONFIG.paths.radar, 'utf8'),
  ) as ScannerBlip[]
  const verdictsPath = SCANNER_CONFIG.paths.verdicts
  let cache: import('./types').VerdictCache = {}
  if (existsSync(verdictsPath)) {
    const rawVerdicts = await readFile(verdictsPath, 'utf8')
    try {
      cache = JSON.parse(rawVerdicts) as import('./types').VerdictCache
    } catch (err) {
      throw new Error(
        `Refusing to scan: ${verdictsPath} is not valid JSON (fix or delete it): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
  const today = new Date().toISOString().slice(0, 10)
  const log = (m: string) => process.stderr.write(m + '\n')
  const result = await runScan(gh, llm, existingRaw, cache, today, log)

  // Safety guardrail: candidate must parse, and no pinned/existing blip may vanish.
  parseRadar(result.candidate)
  const candidateSlugs = new Set(result.candidate.map((b) => slugify(b.name)))
  const dropped = existingRaw.filter((b) => !candidateSlugs.has(slugify(b.name)))
  if (dropped.length)
    throw new Error(`Refusing to write: dropped ${dropped.map((b) => b.name).join(', ')}`)

  await writeFile(SCANNER_CONFIG.paths.radar, JSON.stringify(result.candidate, null, 2) + '\n')
  await mkdir(SCANNER_CONFIG.paths.detectionsDir, { recursive: true })
  await writeFile(
    join(SCANNER_CONFIG.paths.detectionsDir, `${today}.json`),
    JSON.stringify({ detections: result.detections, suppressed: result.suppressed }, null, 2) +
      '\n',
  )
  const sortedVerdicts = Object.fromEntries(
    Object.entries(result.verdicts ?? {}).sort(([a], [b]) => a.localeCompare(b)),
  )
  await writeFile(verdictsPath, JSON.stringify(sortedVerdicts, null, 2) + '\n')
  process.stdout.write(result.report)
}

main().catch((err) => {
  process.stderr.write(`Scan failed: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exitCode = 1
})
