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

// Default LLM promotes unknowns to radar (e.g. React from package.json)
const llm: LLMClient = {
  describe: vi.fn().mockResolvedValue('Beschreibung.'),
  triage: vi
    .fn()
    .mockResolvedValue({ verdict: 'radar', quadrant: 'languages-frameworks', confidence: 0.9 }),
}

describe('runScan', () => {
  it('produces a candidate that includes detected techs and a valid report', async () => {
    const existing: ScannerBlip[] = []
    const result = await runScan(gh, llm, existing, {}, '2026-06-22')
    const names = result.candidate.map((b) => b.name)
    expect(names).toContain('React')
    expect(names).toContain('Docker')
    expect(names).toContain('TypeScript')
    expect(result.report).toMatch(/Scanned \*\*1 repos/)
    expect(llm.triage).toHaveBeenCalled()
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
    const result = await runScan(gh, llm, existing, {}, '2026-06-22')
    expect(result.candidate.find((b) => b.name === 'Scrum')).toBeTruthy()
  })

  it('returns suppressed (not candidates) in result shape', async () => {
    const llmNoise: LLMClient = {
      describe: vi.fn().mockResolvedValue('desc'),
      triage: vi.fn().mockResolvedValue({ verdict: 'noise', confidence: 0.9 }),
    }
    const existing: ScannerBlip[] = []
    const result = await runScan(gh, llmNoise, existing, {}, '2026-06-22')
    expect(result).toHaveProperty('suppressed')
    expect(result).not.toHaveProperty('candidates')
  })

  it('auto-promotes a triaged radar unknown into a new blip and records its verdict', async () => {
    // gh fake returns one repo whose package.json has "some-new-lib" (unrecognised dep → LLM triage)
    const llmTriage: LLMClient = {
      describe: vi.fn().mockResolvedValue('desc'),
      triage: vi
        .fn()
        .mockResolvedValue({ verdict: 'radar', quadrant: 'languages-frameworks', confidence: 0.9 }),
    }
    const ghUnknown: GitHubClient = {
      listRepos: vi
        .fn()
        .mockResolvedValue([{ name: 'graphmind', defaultBranch: 'main', pushedAt: '2026-06-18' }]),
      getLanguages: vi.fn().mockResolvedValue({}),
      listFiles: vi.fn().mockResolvedValue(['package.json']),
      getFileContent: vi
        .fn()
        .mockResolvedValue(JSON.stringify({ dependencies: { 'some-new-lib': '^0.1' } })),
    }
    const result = await runScan(ghUnknown, llmTriage, [], {}, '2026-06-22')
    expect(result.candidate.find((b) => b.name === 'Some New Lib')).toBeTruthy()
    expect(result.verdicts['some-new-lib']).toMatchObject({ verdict: 'radar', source: 'llm' })
  })

  it('rolls up a child unknown into its parent detection and records child as noise', async () => {
    // Repo A: detects 'react' (seeded cache → direct radar hit) via package.json
    // Repo B: detects 'some-helper' (unknown) which LLM resolves as child of React
    const cache = {
      react: {
        verdict: 'radar' as const,
        quadrant: 'languages-frameworks' as const,
        source: 'seed' as const,
        confidence: 1,
        decidedAt: '2026-01-01',
      },
    }
    const llmChild: LLMClient = {
      describe: vi.fn().mockResolvedValue('desc'),
      // Only 'some-helper' reaches triage; it resolves as child of React
      triage: vi.fn().mockResolvedValue({ verdict: 'child', parent: 'React', confidence: 0.9 }),
    }
    const ghChild: GitHubClient = {
      listRepos: vi.fn().mockResolvedValue([
        { name: 'repo-a', defaultBranch: 'main', pushedAt: '2026-06-18' },
        { name: 'repo-b', defaultBranch: 'main', pushedAt: '2026-06-18' },
      ]),
      getLanguages: vi.fn().mockResolvedValue({}),
      listFiles: vi.fn().mockResolvedValue(['package.json']),
      getFileContent: vi
        .fn()
        .mockResolvedValueOnce(JSON.stringify({ dependencies: { react: '^19' } })) // repo-a
        .mockResolvedValueOnce(JSON.stringify({ dependencies: { 'some-helper': '^1' } })), // repo-b
    }
    const result = await runScan(ghChild, llmChild, [], cache, '2026-06-22')

    const reactDetection = result.detections.find((d) => d.name === 'React')
    expect(reactDetection).toBeTruthy()
    // React was detected in repo-a; after child-rollup repo-b's 'some-helper' adds to React's sourceRepos
    expect(reactDetection!.sourceRepos).toContain('repo-b')
    // React's repoCount grew to include repo-b
    expect(reactDetection!.repoCount).toBeGreaterThan(1)
    // some-helper must be recorded as noise in the verdicts
    expect(result.verdicts['some-helper']).toMatchObject({ verdict: 'noise', source: 'llm' })
  })

  it('does not double-count repoCount when child co-occurs with parent in the same repo', async () => {
    // ONE repo (repo-a) whose package.json contains BOTH 'react' (seeded → radar) AND
    // 'some-helper' (unknown → LLM returns child of React).
    // After rollup React must still show repoCount === 1, sourceRepos === ['repo-a'] with no dupe.
    const cache = {
      react: {
        verdict: 'radar' as const,
        quadrant: 'languages-frameworks' as const,
        source: 'seed' as const,
        confidence: 1,
        decidedAt: '2026-01-01',
      },
    }
    const llmChild: LLMClient = {
      describe: vi.fn().mockResolvedValue('desc'),
      triage: vi.fn().mockResolvedValue({ verdict: 'child', parent: 'React', confidence: 0.9 }),
    }
    const ghSameRepo: GitHubClient = {
      listRepos: vi
        .fn()
        .mockResolvedValue([{ name: 'repo-a', defaultBranch: 'main', pushedAt: '2026-06-18' }]),
      getLanguages: vi.fn().mockResolvedValue({}),
      listFiles: vi.fn().mockResolvedValue(['package.json']),
      // repo-a package.json has both react AND some-helper
      getFileContent: vi
        .fn()
        .mockResolvedValue(JSON.stringify({ dependencies: { react: '^19', 'some-helper': '^1' } })),
    }
    const result = await runScan(ghSameRepo, llmChild, [], cache, '2026-06-22')

    const reactDetection = result.detections.find((d) => d.name === 'React')
    expect(reactDetection).toBeTruthy()
    // repo-a must appear exactly once — no double-count from the child rollup
    expect(reactDetection!.repoCount).toBe(1)
    expect(reactDetection!.sourceRepos).toEqual(['repo-a'])
    // some-helper is noise
    expect(result.verdicts['some-helper']).toMatchObject({ verdict: 'noise', source: 'llm' })
  })
})
