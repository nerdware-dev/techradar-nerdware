export interface RepoMeta {
  name: string
  defaultBranch: string
  pushedAt: string
}

export interface GitHubClient {
  listRepos(): Promise<RepoMeta[]>
  getLanguages(repo: string): Promise<Record<string, number>>
  listFiles(repo: string, branch: string): Promise<string[]>
  getFileContent(repo: string, path: string): Promise<string | null>
}

/** Minimal subset of @octokit/rest used by the scanner (keeps tests light). */
export interface OctokitLike {
  paginate(route: unknown, params: unknown): Promise<Array<Record<string, unknown>>>
  rest: {
    repos: {
      listForOrg: unknown
      listLanguages(args: {
        owner: string
        repo: string
      }): Promise<{ data: Record<string, number> }>
      getContent(args: { owner: string; repo: string; path: string }): Promise<{ data: unknown }>
    }
    git: {
      getTree(args: {
        owner: string
        repo: string
        tree_sha: string
        recursive: string
      }): Promise<{ data: { tree: Array<{ path?: string; type?: string }> } }>
    }
  }
}

export function createGitHubClient(octokit: OctokitLike, org: string): GitHubClient {
  return {
    async listRepos() {
      const repos = await octokit.paginate(octokit.rest.repos.listForOrg, {
        org,
        type: 'all',
        per_page: 100,
      })
      return repos
        .filter((r) => !r.archived && !r.fork)
        .map((r) => ({
          name: String(r.name),
          defaultBranch: String(r.default_branch),
          pushedAt: String(r.pushed_at).slice(0, 10),
        }))
    },
    async getLanguages(repo) {
      const res = await octokit.rest.repos.listLanguages({ owner: org, repo })
      return res.data
    },
    async listFiles(repo, branch) {
      const res = await octokit.rest.git.getTree({
        owner: org,
        repo,
        tree_sha: branch,
        recursive: 'true',
      })
      return res.data.tree.filter((n) => n.type === 'blob' && n.path).map((n) => n.path as string)
    },
    async getFileContent(repo, path) {
      try {
        const res = await octokit.rest.repos.getContent({ owner: org, repo, path })
        const data = res.data as { content?: string }
        if (!data.content) return null
        return Buffer.from(data.content, 'base64').toString('utf8')
      } catch {
        return null
      }
    },
  }
}
