import { describe, it, expect } from 'vitest'
import { resolve } from './resolve'
import type { DetectedToken, VerdictCache } from './types'

const dep = (raw: string): DetectedToken => ({ raw, kind: 'dependency' })
const lang = (raw: string): DetectedToken => ({ raw, kind: 'language', quadrantHint: 'languages-frameworks' })
const cache: VerdictCache = {
  react: { verdict: 'radar', quadrant: 'languages-frameworks', source: 'seed' },
  axios: { verdict: 'noise', source: 'human' },
}

describe('resolve', () => {
  it('hard-drops ignore-list and @types tokens', () => {
    expect(resolve(dep('@types/react'), cache)).toBeNull()
    expect(resolve(lang('HTML'), cache)).toBeNull()
  })
  it('collapses a family member to its parent verdict', () => {
    expect(resolve(dep('@radix-ui/react-tabs'), cache)).toEqual({
      canonical: 'Radix UI', verdict: 'radar', quadrant: 'languages-frameworks',
    })
    expect(resolve(dep('golang.org/x/sys'), cache)).toEqual({ canonical: 'golang.org/x', verdict: 'noise' })
  })
  it('marks plumbing as noise', () => {
    expect(resolve(dep('eslint-plugin-react'), cache)?.verdict).toBe('noise')
  })
  it('uses the cache for a known canonical dep', () => {
    expect(resolve(dep('react-dom'), cache)).toEqual({
      canonical: 'React', verdict: 'radar', quadrant: 'languages-frameworks',
    })
    expect(resolve(dep('axios'), cache)?.verdict).toBe('noise')
  })
  it('returns unknown for an unrecognized direct dep', () => {
    expect(resolve(dep('langchain'), cache)).toEqual({ canonical: 'Langchain', verdict: 'unknown' })
  })
  it('always treats a language/tool token as radar', () => {
    expect(resolve(lang('Vue'), cache)).toEqual({
      canonical: 'Vue.js', verdict: 'radar', quadrant: 'languages-frameworks',
    })
  })
})
