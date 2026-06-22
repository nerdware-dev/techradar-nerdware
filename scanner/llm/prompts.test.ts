import { describe, it, expect } from 'vitest'
import { parseTriage } from './prompts'

describe('parseTriage', () => {
  it('parses a radar verdict with quadrant and confidence', () => {
    expect(parseTriage('{"verdict":"radar","quadrant":"tools","confidence":0.9}')).toEqual({
      verdict: 'radar',
      quadrant: 'tools',
      confidence: 0.9,
    })
  })
  it('clamps an unknown quadrant to tools', () => {
    expect(parseTriage('{"verdict":"radar","quadrant":"bogus","confidence":0.8}').quadrant).toBe(
      'tools',
    )
  })
  it('falls back to noise on malformed JSON', () => {
    expect(parseTriage('not json')).toEqual({ verdict: 'noise', confidence: 0 })
  })
  it('returns parent for a child verdict', () => {
    expect(parseTriage('{"verdict":"child","parent":"LangChain","confidence":0.7}')).toEqual({
      verdict: 'child',
      parent: 'LangChain',
      confidence: 0.7,
    })
  })
  it('omits parent when absent from a child verdict', () => {
    const r = parseTriage('{"verdict":"child","confidence":0.5}')
    expect(r.verdict).toBe('child')
    expect(r).not.toHaveProperty('parent')
  })
  it('parses fenced JSON (```json ... ```) the Forge model returns', () => {
    const fenced =
      '```json\n{"verdict":"radar","parent":null,"quadrant":"languages-frameworks","confidence":0.95}\n```'
    expect(parseTriage(fenced)).toEqual({
      verdict: 'radar',
      quadrant: 'languages-frameworks',
      confidence: 0.95,
    })
  })
})
