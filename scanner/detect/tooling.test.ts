import { describe, it, expect } from 'vitest'
import { detectTooling } from './tooling'

describe('detectTooling', () => {
  it('detects Docker from a Dockerfile anywhere in the tree', () => {
    const tokens = detectTooling(['svc/Dockerfile'])
    expect(tokens).toContainEqual({ raw: 'Docker', kind: 'tool', quadrantHint: 'platforms' })
  })
  it('detects Terraform from any .tf file', () => {
    expect(detectTooling(['infra/main.tf']).map((t) => t.raw)).toContain('Terraform')
  })
  it('detects GitHub Actions from a workflow file', () => {
    expect(detectTooling(['.github/workflows/ci.yml']).map((t) => t.raw)).toContain('GitHub Actions')
  })
  it('emits each tool at most once', () => {
    const tokens = detectTooling(['a/Dockerfile', 'b/Dockerfile'])
    expect(tokens.filter((t) => t.raw === 'Docker')).toHaveLength(1)
  })
  it('returns nothing when no known tool files are present', () => {
    expect(detectTooling(['src/index.ts'])).toEqual([])
  })
})
