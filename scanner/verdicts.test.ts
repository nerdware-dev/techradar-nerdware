import { describe, it, expect } from 'vitest'
import { lookupVerdict, mergeVerdicts } from './verdicts'
import type { VerdictCache } from './types'

const cache: VerdictCache = {
  react: { verdict: 'radar', quadrant: 'languages-frameworks', source: 'seed' },
  axios: { verdict: 'noise', source: 'human' },
}

describe('lookupVerdict', () => {
  it('finds an entry by slugified canonical name', () => {
    expect(lookupVerdict('React', cache)?.verdict).toBe('radar')
  })
  it('returns undefined for an unknown name', () => {
    expect(lookupVerdict('LangChain', cache)).toBeUndefined()
  })
})

describe('mergeVerdicts', () => {
  it('adds new llm verdicts', () => {
    const next = mergeVerdicts(cache, {
      langchain: {
        verdict: 'radar',
        quadrant: 'languages-frameworks',
        source: 'llm',
        confidence: 0.9,
      },
    })
    expect(next.langchain.source).toBe('llm')
  })
  it('never overwrites a human entry with an llm patch', () => {
    const next = mergeVerdicts(cache, {
      axios: { verdict: 'radar', source: 'llm', confidence: 0.8 },
    })
    expect(next.axios).toEqual({ verdict: 'noise', source: 'human' })
  })
  it('does not mutate the input cache', () => {
    const input = {
      react: { verdict: 'radar', quadrant: 'languages-frameworks', source: 'seed' },
    } as const satisfies VerdictCache
    const before = structuredClone(input)
    mergeVerdicts(input, { axios: { verdict: 'noise', source: 'llm', confidence: 0.8 } })
    expect(input).toEqual(before)
  })
  it('overwrites a non-human (seed/llm) existing entry with the patch', () => {
    const input = {
      react: { verdict: 'radar', quadrant: 'languages-frameworks', source: 'seed' },
    } as const satisfies VerdictCache
    const next = mergeVerdicts(input as never, {
      react: { verdict: 'noise', source: 'llm', confidence: 0.6 },
    })
    expect(next.react).toEqual({ verdict: 'noise', source: 'llm', confidence: 0.6 })
  })
})
