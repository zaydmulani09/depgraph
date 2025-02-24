import { request } from 'undici'
import type { RateLimiter } from '../../lib/rate-limiter'
import { withRetry } from '../../lib/retry'

export interface GitHubRepo {
  id: number
  full_name: string
  owner: { login: string }
  default_branch: string
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  archived: boolean
  pushed_at: string | null
  created_at: string
}

export interface GitHubWeeklyCommit {
  week: number
  total: number
  days: number[]
}

export interface GitHubContributor {
  login: string
  contributions: number
}

export interface GitHubIssue {
  number: number
  state: string
  created_at: string
  closed_at: string | null
  updated_at: string
}

export interface GitHubPR {
  number: number
  state: string
  created_at: string
  merged_at: string | null
  closed_at: string | null
}

export interface GitHubUser {
  login: string
  id: number
  avatar_url: string
  email: string | null
}

export class GitHubApiError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string
  ) {
    super(message)
    this.name = 'GitHubApiError'
  }
}

interface GitHubClientOptions {
  token?: string
  limiter: RateLimiter
}

export class GitHubClient {
  private readonly token?: string
  private readonly limiter: RateLimiter
  private readonly baseUrl = 'https://api.github.com'

  constructor({ token, limiter }: GitHubClientOptions) {
    this.token = token
    this.limiter = limiter
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'depgraph-crawler/0.1.0',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    return headers
  }

  private async doRequest<T>(endpoint: string): Promise<T> {
    return withRetry(async () => {
      await this.limiter.throttle()
      const url = `${this.baseUrl}${endpoint}`
      const { statusCode, headers, body } = await request(url, {
        headers: this.buildHeaders(),
      })

      // Respect rate limit — if remaining hits 0 wait until reset
      const remaining = headers['x-ratelimit-remaining']
      const reset = headers['x-ratelimit-reset']
      if (remaining === '0' && reset) {
        const resetMs = Number(reset) * 1000
        const waitMs = Math.max(0, resetMs - Date.now()) + 500
        console.warn(`[github] Rate limit hit. Waiting ${waitMs}ms until reset.`)
        await new Promise((r) => setTimeout(r, waitMs))
      }

      const text = await body.text()

      if (statusCode >= 200 && statusCode < 300) {
        return JSON.parse(text) as T
      }

      let message = `GitHub API error ${statusCode} at ${endpoint}`
      try {
        const parsed = JSON.parse(text) as { message?: string }
        if (parsed.message) message = parsed.message
      } catch {
        // ignore parse error
      }
      throw new GitHubApiError(statusCode, endpoint, message)
    })
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    return this.doRequest<GitHubRepo>(`/repos/${owner}/${repo}`)
  }

  async getCommitActivity(owner: string, repo: string): Promise<GitHubWeeklyCommit[]> {
    const endpoint = `/repos/${owner}/${repo}/stats/commit_activity`
    // GitHub returns 202 while computing stats — retry up to 5 times with 3s delay
    for (let attempt = 0; attempt < 5; attempt++) {
      await this.limiter.throttle()
      const url = `${this.baseUrl}${endpoint}`
      const { statusCode, body } = await request(url, { headers: this.buildHeaders() })
      const text = await body.text()
      if (statusCode === 202) {
        console.log(`[github] Commit activity computing (attempt ${attempt + 1}/5), waiting 3s...`)
        await new Promise((r) => setTimeout(r, 3000))
        continue
      }
      if (statusCode === 200) {
        return JSON.parse(text) as GitHubWeeklyCommit[]
      }
      const err = new GitHubApiError(statusCode, endpoint, `Failed to get commit activity: ${statusCode}`)
      err.status = statusCode
      throw err
    }
    return [] // give up — return empty rather than throw
  }

  async getContributors(owner: string, repo: string): Promise<GitHubContributor[]> {
    return this.doRequest<GitHubContributor[]>(
      `/repos/${owner}/${repo}/contributors?per_page=100`
    )
  }

  async getIssues(
    owner: string,
    repo: string,
    state: 'open' | 'closed',
    perPage = 30
  ): Promise<GitHubIssue[]> {
    const items = await this.doRequest<Array<GitHubIssue & { pull_request?: unknown }>>(
      `/repos/${owner}/${repo}/issues?state=${state}&per_page=${perPage}&sort=updated`
    )
    // Filter out pull requests
    return items.filter((i) => !i.pull_request)
  }

  async getPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed',
    perPage = 30
  ): Promise<GitHubPR[]> {
    return this.doRequest<GitHubPR[]>(
      `/repos/${owner}/${repo}/pulls?state=${state}&per_page=${perPage}&sort=updated`
    )
  }

  async getUserByLogin(login: string): Promise<GitHubUser | null> {
    try {
      return await this.doRequest<GitHubUser>(`/users/${login}`)
    } catch (err) {
      if (err instanceof GitHubApiError && err.status === 404) return null
      throw err
    }
  }
}
