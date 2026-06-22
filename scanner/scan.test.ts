import { describe, it, expect, vi } from 'vitest'
import { runScan } from './scan'
import type { GitHubClient } from './github'
import type { LLMClient } from './llm/types'
import type { ScannerBlip } from './types'

const gh: GitHubClient = {
  listRepos: vi
    .fn()
    .mockResolvedValue([{ name: 'graphmind', defaultBranch: 'main', pushedAt: '2026-06-18' }]),
  getLanguages: vi.fn().mockResolvedValue({ TypeScript: 1000 }),
  listFiles: vi.fn().mockResolvedValue(['package.json', 'Dockerfile']),
  getFileContent: vi.fn().mockResolvedValue(JSON.stringify({ dependencies: { react: '^19' } })),
}
const llm: LLMClient = {
  categorize: vi.fn().mockResolvedValue({ quadrant: 'tools', confidence: 0.9 }),
  describe: vi.fn().mockResolvedValue('Beschreibung.'),
  triage: vi.fn(),
}

describe('runScan', () => {
  it('produces a candidate that includes detected techs and a valid report', async () => {
    const existing: ScannerBlip[] = []
    const result = await runScan(gh, llm, existing)
    const names = result.candidate.map((b) => b.name)
    expect(names).toContain('React')
    expect(names).toContain('Docker')
    expect(names).toContain('TypeScript')
    expect(result.report).toMatch(/Scanned \*\*1 repos/)
  })

  it('preserves a pinned curated blip that is never detected', async () => {
    const existing: ScannerBlip[] = [
      {
        name: 'Scrum',
        ring: 'high',
        quadrant: 'techniques',
        isNew: 'FALSE',
        description: 'x',
        pinned: true,
      },
    ]
    const result = await runScan(gh, llm, existing)
    expect(result.candidate.find((b) => b.name === 'Scrum')).toBeTruthy()
  })
})
