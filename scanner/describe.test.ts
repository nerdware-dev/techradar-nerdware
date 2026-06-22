import { describe, it, expect, vi } from 'vitest'
import { draftDescription } from './describe'
import type { LLMClient } from './llm/types'
import type { Detection } from './types'

const det: Detection = {
  name: 'Grafana',
  repoCount: 2,
  sourceRepos: ['a', 'b'],
  lastSeen: '2026-06-18',
}

describe('draftDescription', () => {
  it('calls the LLM with the tech name and returns the German draft', async () => {
    const llm: LLMClient = {
      describe: vi.fn().mockResolvedValue('Grafana ist ...'),
      triage: vi.fn(),
    }
    const result = await draftDescription(det, llm)
    expect(result).toBe('Grafana ist ...')
    expect(llm.describe).toHaveBeenCalledWith('Grafana', expect.stringContaining('2'))
  })
})
