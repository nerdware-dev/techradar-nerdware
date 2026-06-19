import OpenAI from 'openai'
import { SCANNER_CONFIG } from '../config'
import type { LLMClient } from './types'
import { createForgeClient, type OpenAILike } from './forgeClient'

/** Construct the LLM client. The scanner talks only to the Forge gateway
 *  (OpenAI-wire). SDK construction makes no network calls. */
export function createLLMClient(env: NodeJS.ProcessEnv = process.env): LLMClient {
  if (!env.FORGE_API_KEY) throw new Error('FORGE_API_KEY is required')
  const openai = new OpenAI({
    apiKey: env.FORGE_API_KEY,
    baseURL: env.FORGE_BASE_URL ?? SCANNER_CONFIG.forgeBaseUrl,
  })
  return createForgeClient(openai as unknown as OpenAILike, SCANNER_CONFIG.models)
}
