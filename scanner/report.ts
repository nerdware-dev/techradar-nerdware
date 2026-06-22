import type { ChangeSet } from './merge'

/** Render a human-readable Markdown summary of a scan's proposed changes. */
export function renderReport(changes: ChangeSet, reposScanned: number, suppressed = 0): string {
  const lines: string[] = []
  lines.push(`# Tech Radar scan`)
  lines.push('')
  lines.push(
    `Scanned **${reposScanned} repos** — ` +
      `**+${changes.added.length} added**, ` +
      `**${changes.ringMoves.length} ring moves**, ` +
      `**${changes.undetected.length} undetected**, ` +
      `**${changes.needsReview.length} needs-review**, ` +
      `**${suppressed} suppressed** (see data/detections/).`,
  )

  if (changes.added.length) {
    lines.push('', '## Added', ...changes.added.map((n) => `- ${n}`))
  }
  if (changes.ringMoves.length) {
    lines.push(
      '',
      '## Ring moves',
      ...changes.ringMoves.map((m) => `- ${m.name}: ${m.from} → ${m.to}`),
    )
  }
  if (changes.reactivated.length) {
    lines.push(
      '',
      '## Detected again — currently Out (confirm before promoting)',
      ...changes.reactivated.map((n) => `- ${n}`),
    )
  }
  if (changes.needsReview.length) {
    lines.push(
      '',
      '## Needs-review (low AI confidence — verify quadrant)',
      ...changes.needsReview.map((n) => `- ${n}`),
    )
  }
  if (changes.undetected.length) {
    lines.push(
      '',
      '## Undetected — confirm still in use / retire manually',
      ...changes.undetected.map((n) => `- ${n}`),
    )
  }
  return lines.join('\n') + '\n'
}
