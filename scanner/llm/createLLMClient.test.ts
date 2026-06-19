// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createLLMClient } from './createLLMClient'

describe('createLLMClient', () => {
  it('builds a Forge client when FORGE_API_KEY is present', () => {
    const client = createLLMClient({ FORGE_API_KEY: 'sk-x' } as NodeJS.ProcessEnv)
    expect(typeof client.categorize).toBe('function')
    expect(typeof client.describe).toBe('function')
  })

  it('throws when FORGE_API_KEY is missing', () => {
    expect(() => createLLMClient({} as NodeJS.ProcessEnv)).toThrow(/FORGE_API_KEY/)
  })

  it('constructs even when a DOM window global is present (jsdom shim for DOMPurify)', () => {
    const g = globalThis as Record<string, unknown>
    const had = 'window' in g
    g.window = {} // simulate scanner/dom-bootstrap
    try {
      expect(() => createLLMClient({ FORGE_API_KEY: 'sk-x' } as NodeJS.ProcessEnv)).not.toThrow()
    } finally {
      if (!had) delete g.window
    }
  })
})
