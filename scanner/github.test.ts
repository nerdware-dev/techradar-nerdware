import { describe, it, expect, vi } from 'vitest'
import { createGitHubClient, type OctokitLike } from './github'

function fakeOctokit() {
  return {
    paginate: vi.fn().mockResolvedValue([
      {
        name: 'live',
        archived: false,
        fork: false,
        default_branch: 'main',
        pushed_at: '2026-06-18T10:00:00Z',
      },
      {
        name: 'old',
        archived: true,
        fork: false,
        default_branch: 'main',
        pushed_at: '2024-01-01T00:00:00Z',
      },
      {
        name: 'forked',
        archived: false,
        fork: true,
        default_branch: 'main',
        pushed_at: '2026-01-01T00:00:00Z',
      },
    ]),
    rest: {
      repos: {
        listForOrg: vi.fn(),
        listLanguages: vi.fn().mockResolvedValue({ data: { TypeScript: 100 } }),
        getContent: vi
          .fn()
          .mockResolvedValue({ data: { content: Buffer.from('hello').toString('base64') } }),
      },
      git: {
        getTree: vi
          .fn()
          .mockResolvedValue({ data: { tree: [{ path: 'package.json', type: 'blob' }] } }),
      },
    },
  }
}

describe('createGitHubClient', () => {
  it('lists only non-archived, non-fork repos with normalized pushedAt date', async () => {
    const gh = createGitHubClient(fakeOctokit() as unknown as OctokitLike, 'nerdware-dev')
    const repos = await gh.listRepos()
    expect(repos).toEqual([{ name: 'live', defaultBranch: 'main', pushedAt: '2026-06-18' }])
  })
  it('returns language byte counts', async () => {
    const gh = createGitHubClient(fakeOctokit() as unknown as OctokitLike, 'nerdware-dev')
    expect(await gh.getLanguages('live')).toEqual({ TypeScript: 100 })
  })
  it('lists blob paths from the recursive tree', async () => {
    const gh = createGitHubClient(fakeOctokit() as unknown as OctokitLike, 'nerdware-dev')
    expect(await gh.listFiles('live', 'main')).toEqual(['package.json'])
  })
  it('decodes base64 file content', async () => {
    const gh = createGitHubClient(fakeOctokit() as unknown as OctokitLike, 'nerdware-dev')
    expect(await gh.getFileContent('live', 'package.json')).toBe('hello')
  })
  it('returns null when a file is missing', async () => {
    const oct = fakeOctokit()
    oct.rest.repos.getContent = vi.fn().mockRejectedValue({ status: 404 })
    const gh = createGitHubClient(oct as unknown as OctokitLike, 'nerdware-dev')
    expect(await gh.getFileContent('live', 'nope.json')).toBeNull()
  })
})
