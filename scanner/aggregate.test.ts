import { describe, it, expect } from 'vitest'
import { aggregate } from './aggregate'
import type { RepoScan } from './types'

const scans: RepoScan[] = [
  {
    repo: 'graphmind',
    pushedAt: '2026-06-17',
    tokens: [
      { raw: 'react', kind: 'dependency' },
      // GitHub returns language names properly cased (e.g. "TypeScript", not "typescript").
      { raw: 'TypeScript', kind: 'language', quadrantHint: 'languages-frameworks' },
    ],
  },
  {
    repo: 'vend',
    pushedAt: '2026-06-15',
    tokens: [
      { raw: 'react-dom', kind: 'dependency' },
      { raw: '@types/node', kind: 'dependency' },
      { raw: 'bcryptjs', kind: 'dependency' },
    ],
  },
]

describe('aggregate', () => {
  it('collapses allowlisted dep aliases and counts distinct repos into detections', () => {
    const react = aggregate(scans).detections.find((d) => d.name === 'React')!
    expect(react.repoCount).toBe(2)
    expect(react.sourceRepos.sort()).toEqual(['graphmind', 'vend'])
  })
  it('records the most recent pushedAt as lastSeen', () => {
    const react = aggregate(scans).detections.find((d) => d.name === 'React')!
    expect(react.lastSeen).toBe('2026-06-17')
  })
  it('keeps a language token as a notable detection with its hint', () => {
    const ts = aggregate(scans).detections.find((d) => d.name === 'TypeScript')!
    expect(ts.quadrantHint).toBe('languages-frameworks')
  })
  it('routes an unrecognized dependency to candidates, not detections', () => {
    const { detections, candidates } = aggregate(scans)
    expect(detections.find((d) => d.name === 'Bcryptjs')).toBeUndefined()
    expect(candidates.find((d) => d.name === 'Bcryptjs')).toBeTruthy()
  })
  it('drops ignored tokens from both buckets', () => {
    const { detections, candidates } = aggregate(scans)
    expect([...detections, ...candidates].some((d) => d.name.includes('types'))).toBe(false)
  })
  it('sorts candidates by adoption (most repos first)', () => {
    const many: RepoScan[] = [
      { repo: 'a', pushedAt: '2026-06-01', tokens: [{ raw: 'foo', kind: 'dependency' }] },
      {
        repo: 'b',
        pushedAt: '2026-06-01',
        tokens: [
          { raw: 'foo', kind: 'dependency' },
          { raw: 'bar', kind: 'dependency' },
        ],
      },
    ]
    const { candidates } = aggregate(many)
    expect(candidates.map((c) => c.name)).toEqual(['Foo', 'Bar'])
  })
})
