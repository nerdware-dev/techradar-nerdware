import { describe, it, expect, vi } from 'vitest'
import { createForgeClient } from './forgeClient'

const chatResponse = (content: string) => ({ choices: [{ message: { content } }] })
const models = { categorize: 'claude-haiku-4-5', describe: 'claude-opus-4-6', triage: 'claude-haiku-4-5' }

describe('createForgeClient', () => {
  it('parses a quadrant + confidence object from an OpenAI-shaped response', async () => {
    const openai = {
      chat: {
        completions: {
          create: vi
            .fn()
            .mockResolvedValue(chatResponse('{"quadrant":"platforms","confidence":0.8}')),
        },
      },
    }
    const client = createForgeClient(openai, models)
    expect(await client.categorize('Redis', 'ctx')).toEqual({
      quadrant: 'platforms',
      confidence: 0.8,
    })
  })

  it('sends the configured forge model alias for describe', async () => {
    const create = vi.fn().mockResolvedValue(chatResponse('Redis ist ein In-Memory-Store.'))
    const openai = { chat: { completions: { create } } }
    const client = createForgeClient(openai, models)
    const text = await client.describe('Redis', 'ctx')
    expect(text).toBe('Redis ist ein In-Memory-Store.')
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-opus-4-6' }))
  })

  it('tolerates a null message content', async () => {
    const openai = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({ choices: [{ message: { content: null } }] }),
        },
      },
    }
    const client = createForgeClient(openai, models)
    expect(await client.describe('X', 'ctx')).toBe('')
  })

  it('sends the configured triage model alias and returns parseTriage output', async () => {
    const create = vi
      .fn()
      .mockResolvedValue(chatResponse('{"verdict":"radar","quadrant":"tools","confidence":0.9}'))
    const openai = { chat: { completions: { create } } }
    const client = createForgeClient(openai, models)
    const result = await client.triage('LangChain', 'ctx')
    expect(result).toEqual({ verdict: 'radar', quadrant: 'tools', confidence: 0.9 })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-haiku-4-5' }))
  })
})
