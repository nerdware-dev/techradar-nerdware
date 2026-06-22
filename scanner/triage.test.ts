import { describe, it, expect, vi } from 'vitest'
import { triageAll } from './triage'
import type { Detection } from './types'
import type { LLMClient } from './llm/types'

const det = (name: string): Detection => ({
  name,
  repoCount: 2,
  sourceRepos: ['a', 'b'],
  lastSeen: '2026-06-22',
})

const fakeLLM = (result: {
  verdict: string
  quadrant?: string
  confidence: number
}): LLMClient => ({
  describe: vi.fn(),
  triage: vi.fn().mockResolvedValue(result),
})

describe('triageAll', () => {
  it('calls the LLM once per unknown and keys results by slug', async () => {
    const llm = fakeLLM({ verdict: 'radar', quadrant: 'languages-frameworks', confidence: 0.9 })
    const out = await triageAll([det('LangChain'), det('Drizzle ORM')], llm)
    expect(out.get('langchain')?.verdict).toBe('radar')
    expect(out.get('drizzle-orm')?.quadrant).toBe('languages-frameworks')
    expect(llm.triage).toHaveBeenCalledTimes(2)
    expect(llm.triage).toHaveBeenCalledWith('LangChain', expect.stringContaining('2'))
  })
})
