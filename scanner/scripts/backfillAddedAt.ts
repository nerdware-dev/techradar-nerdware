import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { slugify } from '../../src/data/slug'
import { SCANNER_CONFIG } from '../config'
import type { ScannerBlip } from '../types'

/** One-shot: give every radar entry an `addedAt` date — the author date of the first commit in
 *  which the radar file contained it — and drop the legacy `isNew` flag the app no longer reads.
 *  Entries that already carry an `addedAt` keep it, so hand corrections survive a re-run.
 *  Run from the repo root: `npx tsx scanner/scripts/backfillAddedAt.ts` */
const radarPath = SCANNER_CONFIG.paths.radar

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

/** Oldest first; each line is "<hash> <YYYY-MM-DD>". */
const commits = git('log', '--reverse', '--format=%H %as', '--', radarPath)
  .trim()
  .split('\n')
  .map((line) => line.split(' ') as [string, string])

const firstSeen = new Map<string, string>()
for (const [hash, date] of commits) {
  const entries = JSON.parse(git('show', `${hash}:${radarPath}`)) as { name: string }[]
  for (const { name } of entries) {
    const slug = slugify(name)
    if (!firstSeen.has(slug)) firstSeen.set(slug, date)
  }
}

/** Puts addedAt where isNew used to be, so the JSON diff stays one line per entry. */
function withAddedAt(blip: ScannerBlip): ScannerBlip {
  const addedAt = blip.addedAt ?? firstSeen.get(slugify(blip.name))
  if (!addedAt) {
    process.stderr.write(`No history found for "${blip.name}"; left without addedAt.\n`)
  }
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(blip)) {
    if (key === 'isNew' || key === 'addedAt') {
      if (addedAt) next.addedAt = addedAt
      continue
    }
    next[key] = value
  }
  if (addedAt && !('addedAt' in next)) next.addedAt = addedAt
  return next as ScannerBlip
}

const radar = JSON.parse(readFileSync(radarPath, 'utf8')) as ScannerBlip[]
writeFileSync(radarPath, JSON.stringify(radar.map(withAddedAt), null, 2) + '\n')
process.stderr.write(
  `Backfilled addedAt for ${radar.length} entries from ${commits.length} commits.\n`,
)
