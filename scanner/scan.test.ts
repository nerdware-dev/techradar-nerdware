import { describe, it, expect, vi } from 'vitest'
import { runScan } from './scan'
import type { GitHubClient } from './github'
import type { LLMClient } from './llm/types'
import type { ScannerBlip } from './types'

// Two repos, both with react (package.json) + Dockerfile + TypeScript, so detected
// techs clear the adoption floor (promoteMinRepos = 2) and auto-promote.
const gh: GitHubClient = {
  listRepos: vi.fn().mockResolvedValue([
    { name: 'graphmind', defaultBranch: 'main', pushedAt: '2026-06-18' },
    { name: 'vend', defaultBranch: 'main', pushedAt: '2026-06-17' },
  ]),
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

/** A single-repo GitHub client whose package.json holds one unknown dep. */
function oneRepoWith(dep: string): GitHubClient {
  return {
    listRepos: vi
      .fn()
      .mockResolvedValue([{ name: 'solo', defaultBranch: 'main', pushedAt: '2026-06-18' }]),
    getLanguages: vi.fn().mockResolvedValue({}),
    listFiles: vi.fn().mockResolvedValue(['package.json']),
    getFileContent: vi.fn().mockResolvedValue(JSON.stringify({ dependencies: { [dep]: '^1' } })),
  }
}

describe('runScan', () => {
  it('produces a candidate that includes detected techs and a valid report', async () => {
    const result = await runScan(gh, llm, [], {}, '2026-06-22')
    const names = result.candidate.map((b) => b.name)
    expect(names).toContain('React')
    expect(names).toContain('Docker')
    expect(names).toContain('TypeScript')
    expect(result.report).toMatch(/Scanned \*\*2 repos/)
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

  it('returns suppressed/belowThreshold (not candidates) in result shape', async () => {
    const llmNoise: LLMClient = {
      describe: vi.fn().mockResolvedValue('desc'),
      triage: vi.fn().mockResolvedValue({ verdict: 'noise', confidence: 0.9 }),
    }
    const result = await runScan(gh, llmNoise, [], {}, '2026-06-22')
    expect(result).toHaveProperty('suppressed')
    expect(result).toHaveProperty('belowThreshold')
    expect(result).not.toHaveProperty('candidates')
  })

  it('auto-promotes a triaged radar unknown that clears the adoption floor', async () => {
    // some-new-lib appears in BOTH repos (repoCount 2 ≥ floor) → promoted to a blip.
    const ghTwo: GitHubClient = {
      listRepos: vi.fn().mockResolvedValue([
        { name: 'a', defaultBranch: 'main', pushedAt: '2026-06-18' },
        { name: 'b', defaultBranch: 'main', pushedAt: '2026-06-17' },
      ]),
      getLanguages: vi.fn().mockResolvedValue({}),
      listFiles: vi.fn().mockResolvedValue(['package.json']),
      getFileContent: vi
        .fn()
        .mockResolvedValue(JSON.stringify({ dependencies: { 'some-new-lib': '^0.1' } })),
    }
    const result = await runScan(ghTwo, llm, [], {}, '2026-06-22')
    expect(result.candidate.find((b) => b.name === 'Some New Lib')).toBeTruthy()
    expect(result.verdicts['some-new-lib']).toMatchObject({ verdict: 'radar', source: 'llm' })
  })

  it('routes a below-floor new radar tech to belowThreshold, not the radar', async () => {
    // some-new-lib in a single repo (repoCount 1 < floor) → review list, not a blip.
    const result = await runScan(oneRepoWith('some-new-lib'), llm, [], {}, '2026-06-22')
    expect(result.candidate.find((b) => b.name === 'Some New Lib')).toBeUndefined()
    expect(result.belowThreshold.find((d) => d.name === 'Some New Lib')).toBeTruthy()
    // its radar verdict is still cached, so it can auto-promote once adoption grows
    expect(result.verdicts['some-new-lib']).toMatchObject({ verdict: 'radar', source: 'llm' })
  })

  it('keeps an existing blip even when detected in only one repo (floor never gates existing)', async () => {
    const existing: ScannerBlip[] = [
      {
        name: 'React',
        ring: 'high',
        quadrant: 'languages-frameworks',
        isNew: 'FALSE',
        description: 'x',
      },
    ]
    const result = await runScan(oneRepoWith('react'), llm, existing, {}, '2026-06-22')
    expect(result.candidate.find((b) => b.name === 'React')).toBeTruthy()
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

    // React ends with repoCount 2 (repo-a + rolled-up repo-b) → clears floor, promoted.
    const reactDetection = result.detections.find((d) => d.name === 'React')
    expect(reactDetection).toBeTruthy()
    expect(reactDetection!.sourceRepos).toContain('repo-b')
    expect(reactDetection!.repoCount).toBeGreaterThan(1)
    expect(result.verdicts['some-helper']).toMatchObject({ verdict: 'noise', source: 'llm' })
  })

  it('does not double-count repoCount when child co-occurs with parent in the same repo', async () => {
    // ONE repo (repo-a) whose package.json contains BOTH 'react' (seeded → radar) AND
    // 'some-helper' (unknown → LLM returns child of React). After dedup React stays at
    // repoCount 1 — which is below the floor, so it lands in belowThreshold (new tech).
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
      getFileContent: vi
        .fn()
        .mockResolvedValue(JSON.stringify({ dependencies: { react: '^19', 'some-helper': '^1' } })),
    }
    const result = await runScan(ghSameRepo, llmChild, [], cache, '2026-06-22')

    const reactDetection = result.belowThreshold.find((d) => d.name === 'React')
    expect(reactDetection).toBeTruthy()
    // repo-a must appear exactly once — no double-count from the child rollup
    expect(reactDetection!.repoCount).toBe(1)
    expect(reactDetection!.sourceRepos).toEqual(['repo-a'])
    expect(result.verdicts['some-helper']).toMatchObject({ verdict: 'noise', source: 'llm' })
  })
})
