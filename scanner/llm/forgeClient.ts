import type { LLMClient, ModelPair } from './types'
import { describePrompt, triagePrompt, parseTriage } from './prompts'

/** Minimal shape of the OpenAI SDK we depend on (keeps tests SDK-free). */
export interface OpenAILike {
  chat: {
    completions: {
      create(args: unknown): Promise<{ choices: { message: { content: string | null } }[] }>
    }
  }
}

function firstContent(res: { choices: { message: { content: string | null } }[] }): string {
  return res.choices[0]?.message?.content ?? ''
}

/** OpenAI-wire LLM client for the Forge gateway (the scanner's only LLM provider). */
export function createForgeClient(openai: OpenAILike, models: ModelPair): LLMClient {
  return {
    async describe(name, context) {
      const res = await openai.chat.completions.create({
        model: models.describe,
        max_tokens: 400,
        messages: [{ role: 'user', content: describePrompt(name, context) }],
      })
      return firstContent(res).trim()
    },
    async triage(name, context) {
      const res = await openai.chat.completions.create({
        model: models.triage,
        max_tokens: 256,
        messages: [{ role: 'user', content: triagePrompt(name, context) }],
      })
      return parseTriage(firstContent(res))
    },
  }
}
