import { describe, it, expect } from 'vitest'
import { aggregate } from './aggregate'
import type { RepoScan, VerdictCache } from './types'

const cache: VerdictCache = {
  react: { verdict: 'radar', quadrant: 'languages-frameworks', source: 'seed' },
}
const scans: RepoScan[] = [
  {
    repo: 'a',
    pushedAt: '2026-06-17',
    tokens: [
      { raw: 'react', kind: 'dependency' },
      { raw: '@radix-ui/react-tabs', kind: 'dependency' },
      { raw: 'TypeScript', kind: 'language', quadrantHint: 'languages-frameworks' },
    ],
  },
  {
    repo: 'b',
    pushedAt: '2026-06-15',
    tokens: [
      { raw: 'react-dom', kind: 'dependency' },
      { raw: '@radix-ui/react-dialog', kind: 'dependency' },
      { raw: 'tslib', kind: 'dependency' },
      { raw: 'langchain', kind: 'dependency' },
    ],
  },
]

describe('aggregate', () => {
  it('groups radar verdicts by canonical and counts distinct repos', () => {
    const react = aggregate(scans, cache).detections.find((d) => d.name === 'React')!
    expect(react.repoCount).toBe(2)
    expect(react.quadrant).toBe('languages-frameworks')
  })
  it('collapses family sub-packages into one detection', () => {
    const radix = aggregate(scans, cache).detections.find((d) => d.name === 'Radix UI')!
    expect(radix.repoCount).toBe(2)
  })
  it('routes plumbing to suppressed and unknown deps to unknowns', () => {
    const { unknowns, suppressed } = aggregate(scans, cache)
    expect(unknowns.find((d) => d.name === 'Langchain')).toBeTruthy()
    expect(suppressed.find((d) => d.name === 'Tslib')).toBeTruthy()
  })
  it('keeps a language token as a radar detection', () => {
    expect(aggregate(scans, cache).detections.find((d) => d.name === 'TypeScript')).toBeTruthy()
  })
})
