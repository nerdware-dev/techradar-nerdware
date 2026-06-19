import { describe, it, expect } from 'vitest'
import { aggregate } from './aggregate'
import type { RepoScan } from './types'

const scans: RepoScan[] = [
  {
    repo: 'graphmind',
    pushedAt: '2026-06-17',
    tokens: [
      { raw: 'react', kind: 'dependency' },
      { raw: 'typescript', kind: 'language', quadrantHint: 'languages-frameworks' },
    ],
  },
  {
    repo: 'vend',
    pushedAt: '2026-06-15',
    tokens: [
      { raw: 'react-dom', kind: 'dependency' },
      { raw: '@types/node', kind: 'dependency' },
    ],
  },
]

describe('aggregate', () => {
  it('collapses aliases and counts distinct repos', () => {
    const react = aggregate(scans).find((d) => d.name === 'React')!
    expect(react.repoCount).toBe(2)
    expect(react.sourceRepos.sort()).toEqual(['graphmind', 'vend'])
  })
  it('records the most recent pushedAt as lastSeen', () => {
    const react = aggregate(scans).find((d) => d.name === 'React')!
    expect(react.lastSeen).toBe('2026-06-17')
  })
  it('drops ignored tokens', () => {
    expect(aggregate(scans).some((d) => d.name.includes('types'))).toBe(false)
  })
  it('preserves a quadrant hint when present', () => {
    const ts = aggregate(scans).find((d) => d.name === 'TypeScript')!
    expect(ts.quadrantHint).toBe('languages-frameworks')
  })
})
