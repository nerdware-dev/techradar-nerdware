import { describe, it, expect, vi } from 'vitest'
import { categorize } from './categorize'
import type { LLMClient } from './llm/types'
import type { Detection } from './types'
import type { QuadrantId } from '../src/data/types'

const det = (name: string, quadrantHint?: Detection['quadrantHint']): Detection => ({
  name,
  repoCount: 1,
  sourceRepos: ['r'],
  lastSeen: '2026-06-18',
  quadrantHint,
})

const fakeLLM = (quadrant: QuadrantId, confidence: number): LLMClient => ({
  categorize: vi.fn().mockResolvedValue({ quadrant, confidence }),
  describe: vi.fn(),
  triage: vi.fn(),
})

describe('categorize', () => {
  it('uses the detector quadrant hint without calling the LLM', async () => {
    const llm = fakeLLM('tools', 0.1)
    const result = await categorize(det('Docker', 'platforms'), llm)
    expect(result).toEqual({ quadrant: 'platforms', needsReview: false })
    expect(llm.categorize).not.toHaveBeenCalled()
  })

  it('uses the static quadrant table without calling the LLM', async () => {
    const llm = fakeLLM('tools', 0.1)
    const result = await categorize(det('React'), llm)
    expect(result.quadrant).toBe('languages-frameworks')
    expect(llm.categorize).not.toHaveBeenCalled()
  })

  it('falls back to the LLM for unknown techs', async () => {
    const llm = fakeLLM('tools', 0.9)
    const result = await categorize(det('Grafana'), llm)
    expect(result).toEqual({ quadrant: 'tools', needsReview: false })
    expect(llm.categorize).toHaveBeenCalledOnce()
  })

  it('flags low-confidence LLM categorizations as needs-review', async () => {
    const llm = fakeLLM('tools', 0.4)
    const result = await categorize(det('Grafana'), llm)
    expect(result.needsReview).toBe(true)
  })
})
