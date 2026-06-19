// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createLLMClient } from './createLLMClient'

describe('createLLMClient', () => {
  it('builds a forge client when LLM_PROVIDER=forge and a key is present', () => {
    const client = createLLMClient({ LLM_PROVIDER: 'forge', FORGE_API_KEY: 'sk-x' } as NodeJS.ProcessEnv)
    expect(typeof client.categorize).toBe('function')
    expect(typeof client.describe).toBe('function')
  })

  it('throws when forge is selected without a key', () => {
    expect(() => createLLMClient({ LLM_PROVIDER: 'forge' } as NodeJS.ProcessEnv)).toThrow(/FORGE_API_KEY/)
  })

  it('defaults to the anthropic provider and requires its key', () => {
    expect(() => createLLMClient({} as NodeJS.ProcessEnv)).toThrow(/ANTHROPIC_API_KEY/)
    const client = createLLMClient({ ANTHROPIC_API_KEY: 'x' } as NodeJS.ProcessEnv)
    expect(typeof client.categorize).toBe('function')
  })
})
