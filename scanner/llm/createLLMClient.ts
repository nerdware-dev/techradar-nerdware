import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { SCANNER_CONFIG } from '../config'
import type { LLMClient } from './types'
import { createAnthropicClient } from './anthropicClient'
import { createForgeClient, type OpenAILike } from './forgeClient'

/** Choose and construct the LLM provider from the environment.
 *  `anthropic` (default) calls Anthropic directly; `forge` routes through the
 *  OpenAI-wire Nerdware gateway. SDK construction makes no network calls. */
export function createLLMClient(env: NodeJS.ProcessEnv = process.env): LLMClient {
  const provider = env.LLM_PROVIDER ?? SCANNER_CONFIG.defaultProvider
  if (provider === 'forge') {
    if (!env.FORGE_API_KEY) throw new Error('LLM_PROVIDER=forge requires FORGE_API_KEY')
    const openai = new OpenAI({
      apiKey: env.FORGE_API_KEY,
      baseURL: env.FORGE_BASE_URL ?? SCANNER_CONFIG.forgeBaseUrl,
    })
    return createForgeClient(openai as unknown as OpenAILike, SCANNER_CONFIG.models.forge)
  }
  if (!env.ANTHROPIC_API_KEY) throw new Error('LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY')
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  return createAnthropicClient(anthropic, SCANNER_CONFIG.models.anthropic)
}
