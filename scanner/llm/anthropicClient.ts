import type { QuadrantId } from '../../src/data/types'
import { QUADRANTS } from '../../src/config'
import type { LLMClient, ModelPair } from './types'

/** Minimal shape of the Anthropic SDK we depend on (keeps tests SDK-free). */
export interface AnthropicLike {
  messages: { create(args: unknown): Promise<{ content: { type: string; text?: string }[] }> }
}

const QUADRANT_IDS = QUADRANTS.map((q) => q.id) as QuadrantId[]
// Annotated as QuadrantId[] so .includes(QuadrantId) type-checks (TS 6 would
// otherwise narrow the filtered element type to exclude 'techniques').
const DETECTABLE: QuadrantId[] = QUADRANT_IDS.filter((q) => q !== 'techniques')

/** Prompt builders shared with the Forge client so both providers ask identically. */
export function categorizePrompt(name: string, context: string): string {
  return (
    `Classify the technology "${name}" into exactly one tech-radar quadrant.\n` +
    `${context}\n` +
    `Allowed quadrants: ${DETECTABLE.join(', ')}.\n` +
    `Reply with ONLY a JSON object: {"quadrant": "<id>", "confidence": <0..1>}.`
  )
}

export function describePrompt(name: string, context: string): string {
  return (
    `Schreibe eine sachliche deutsche Kurzbeschreibung (2-4 Sätze) der Technologie "${name}" ` +
    `für einen Tech-Radar. Kontext: ${context} Antworte nur mit der Beschreibung, ohne Vorrede.`
  )
}

/** Parse the categorize JSON, clamping unknown quadrants to a safe default. */
export function parseCategory(text: string): { quadrant: QuadrantId; confidence: number } {
  try {
    const parsed = JSON.parse(text) as { quadrant: string; confidence: number }
    if (!DETECTABLE.includes(parsed.quadrant as QuadrantId)) return { quadrant: 'tools', confidence: 0 }
    return { quadrant: parsed.quadrant as QuadrantId, confidence: parsed.confidence }
  } catch {
    return { quadrant: 'tools', confidence: 0 }
  }
}

function firstText(res: { content: { type: string; text?: string }[] }): string {
  return res.content.find((b) => b.type === 'text')?.text ?? ''
}

export function createAnthropicClient(sdk: AnthropicLike, models: ModelPair): LLMClient {
  return {
    async categorize(name, context) {
      const res = await sdk.messages.create({
        model: models.categorize,
        max_tokens: 256,
        messages: [{ role: 'user', content: categorizePrompt(name, context) }],
      })
      return parseCategory(firstText(res))
    },
    async describe(name, context) {
      const res = await sdk.messages.create({
        model: models.describe,
        max_tokens: 400,
        messages: [{ role: 'user', content: describePrompt(name, context) }],
      })
      return firstText(res).trim()
    },
  }
}
