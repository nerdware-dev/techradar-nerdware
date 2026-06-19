import { describe, it, expect } from 'vitest'
import { detectLanguages } from './languages'

describe('detectLanguages', () => {
  it('emits a language-kind token with a languages-frameworks hint', () => {
    const tokens = detectLanguages({ TypeScript: 1000 })
    expect(tokens[0]).toMatchObject({ raw: 'TypeScript', kind: 'language', quadrantHint: 'languages-frameworks' })
  })
  it('ignores languages below the noise ratio', () => {
    const tokens = detectLanguages({ TypeScript: 9900, HTML: 100 })
    expect(tokens.map((t) => t.raw)).toEqual(['TypeScript'])
  })
  it('returns nothing for an empty repo', () => {
    expect(detectLanguages({})).toEqual([])
  })
})
