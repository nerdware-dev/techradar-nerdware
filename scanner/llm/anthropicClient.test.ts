import { describe, it, expect, vi } from 'vitest'
import { createAnthropicClient } from './anthropicClient'

const textResponse = (text: string) => ({ content: [{ type: 'text', text }] })
const models = { categorize: 'claude-haiku-4-5', describe: 'claude-opus-4-8' }

describe('createAnthropicClient', () => {
  it('parses a quadrant + confidence JSON object from categorize', async () => {
    const sdk = { messages: { create: vi.fn().mockResolvedValue(textResponse('{"quadrant":"tools","confidence":0.9}')) } }
    const client = createAnthropicClient(sdk, models)
    expect(await client.categorize('Grafana', 'ctx')).toEqual({ quadrant: 'tools', confidence: 0.9 })
  })

  it('clamps an unknown quadrant to tools with zero confidence', async () => {
    const sdk = { messages: { create: vi.fn().mockResolvedValue(textResponse('{"quadrant":"banana","confidence":0.9}')) } }
    const client = createAnthropicClient(sdk, models)
    expect(await client.categorize('X', 'ctx')).toEqual({ quadrant: 'tools', confidence: 0 })
  })

  it('returns the text body from describe', async () => {
    const sdk = { messages: { create: vi.fn().mockResolvedValue(textResponse('Grafana ist ein Tool.')) } }
    const client = createAnthropicClient(sdk, models)
    expect(await client.describe('Grafana', 'ctx')).toBe('Grafana ist ein Tool.')
  })
})
