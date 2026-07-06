import { describe, it, expect } from 'vitest'
import { deriveImplied } from './derive'
import type { Detection } from './types'

const det = (name: string, repos: string[], lastSeen = '2026-07-01'): Detection => ({
  name,
  repoCount: repos.length,
  sourceRepos: repos,
  lastSeen,
})

describe('deriveImplied', () => {
  it('derives an abstract blip from a single source', () => {
    const out = deriveImplied([det('Terraform', ['a', 'b'])])
    const iac = out.find((d) => d.name === 'Infrastructure as Code')!
    expect(iac.derived).toBe(true)
    expect(iac.sourceRepos.sort()).toEqual(['a', 'b'])
    expect(iac.repoCount).toBe(2)
  })

  it('unions repos and takes max lastSeen across multiple sources', () => {
    const out = deriveImplied([
      det('AWS', ['a', 'b'], '2026-06-01'),
      det('Azure', ['b', 'c'], '2026-07-05'),
    ])
    const cn = out.find((d) => d.name === 'Cloud Networking')!
    expect(cn.sourceRepos.sort()).toEqual(['a', 'b', 'c'])
    expect(cn.repoCount).toBe(3)
    expect(cn.lastSeen).toBe('2026-07-05')
  })

  it('produces no derived entry when no source is present', () => {
    const out = deriveImplied([det('React', ['a'])])
    expect(out.every((d) => !d.derived)).toBe(true)
    expect(out).toHaveLength(1)
  })

  it('leaves input array and objects untouched', () => {
    const input = [det('Terraform', ['a'])]
    const before = JSON.parse(JSON.stringify(input))
    deriveImplied(input)
    expect(input).toEqual(before)
  })

  it('augments an already-real target instead of duplicating it', () => {
    const out = deriveImplied([
      det('Apache Kafka', ['a']),
      det('Message Queues', ['z']), // already detected directly (hypothetical)
    ])
    const mq = out.filter((d) => d.name === 'Message Queues')
    expect(mq).toHaveLength(1)
    expect(mq[0].derived).toBeUndefined()
    expect(mq[0].sourceRepos.sort()).toEqual(['a', 'z'])
  })
})
