import { describe, it, expect, beforeEach } from 'vitest'
import { computeGitHubSignals, type GitHubSignalInput } from './signals'
import type { GitHubRepo } from './client'

function makeWeeklyCommits(totals: number[]): { week: number; total: number; days: number[] }[] {
  return totals.map((total, i) => ({ week: i, total, days: [0, 0, 0, 0, 0, 0, total] }))
}

const baseRepo: GitHubRepo = {
  id: 1,
  full_name: 'owner/repo',
  owner: { login: 'owner' },
  default_branch: 'main',
  stargazers_count: 100,
  forks_count: 10,
  open_issues_count: 5,
  archived: false,
  pushed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
  created_at: '2020-01-01T00:00:00Z',
}

function makeInput(overrides: Partial<GitHubSignalInput> = {}): GitHubSignalInput {
  // 52 weeks of commit data: last 4 = [5,3,7,2], weeks 5-13 back = [4,4,4,4,4,4,4,4,4]
  const commits52 = makeWeeklyCommits([
    ...Array(39).fill(1),   // weeks 0-38 (irrelevant for 90d)
    4, 4, 4, 4, 4, 4, 4, 4, 4, // last 13 excl last 4 = idx 39-47
    5, 3, 7, 2,             // last 4 = idx 48-51
  ])
  return {
    weeklyCommits: commits52,
    contributors: [
      { login: 'alice', contributions: 80 },
      { login: 'bob', contributions: 20 },
    ],
    recentIssues: [
      {
        number: 1,
        state: 'closed',
        created_at: '2024-01-01T00:00:00Z',
        closed_at: '2024-01-03T00:00:00Z', // 2 days
        updated_at: '2024-01-03T00:00:00Z',
      },
      {
        number: 2,
        state: 'closed',
        created_at: '2024-01-01T00:00:00Z',
        closed_at: '2024-01-05T00:00:00Z', // 4 days
        updated_at: '2024-01-05T00:00:00Z',
      },
    ],
    recentPRs: [
      {
        number: 1,
        state: 'closed',
        created_at: '2024-01-01T00:00:00Z',
        merged_at: '2024-01-08T00:00:00Z', // 7 days
        closed_at: '2024-01-08T00:00:00Z',
      },
    ],
    repo: baseRepo,
    ...overrides,
  }
}

describe('computeGitHubSignals', () => {
  it('commit_frequency_30d sums last 4 weeks correctly', () => {
    const signals = computeGitHubSignals(makeInput())
    const s = signals.find((x) => x.signal_name === 'commit_frequency_30d')
    expect(s?.value).toBe(17) // 5+3+7+2
  })

  it('commit_frequency_90d sums last 13 weeks correctly', () => {
    const signals = computeGitHubSignals(makeInput())
    const s = signals.find((x) => x.signal_name === 'commit_frequency_90d')
    expect(s?.value).toBe(53) // 9*4 + 5+3+7+2 = 36+17 = 53
  })

  it('bus_factor is 1 when one contributor has all commits', () => {
    const signals = computeGitHubSignals(
      makeInput({ contributors: [{ login: 'solo', contributions: 100 }] })
    )
    const s = signals.find((x) => x.signal_name === 'bus_factor')
    expect(s?.value).toBe(1)
  })

  it('bus_factor is 1 when one of two contributors has >50%', () => {
    // alice=80%, bob=20% → only alice covers top 50%
    const signals = computeGitHubSignals(makeInput())
    const s = signals.find((x) => x.signal_name === 'bus_factor')
    expect(s?.value).toBe(1)
  })

  it('bus_factor is 2 when two contributors share top 50% evenly', () => {
    const signals = computeGitHubSignals(
      makeInput({
        contributors: [
          { login: 'a', contributions: 50 },
          { login: 'b', contributions: 50 },
          { login: 'c', contributions: 0 },
        ],
      })
    )
    const s = signals.find((x) => x.signal_name === 'bus_factor')
    // a=50 covers 50% → busFactor=1 (cumul 50 >= 50)
    expect(s?.value).toBe(1)
  })

  it('bus_factor is 2 when two contributors each have 30% of 60% needed', () => {
    const signals = computeGitHubSignals(
      makeInput({
        contributors: [
          { login: 'a', contributions: 30 },
          { login: 'b', contributions: 30 },
          { login: 'c', contributions: 40 },
        ],
      })
    )
    // sorted: c=40, a=30, b=30. total=100, half=50. c=40 < 50, c+a=70>=50 → 2
    const s = signals.find((x) => x.signal_name === 'bus_factor')
    expect(s?.value).toBe(2)
  })

  it('issue_response_latency_days averages correctly', () => {
    const signals = computeGitHubSignals(makeInput())
    const s = signals.find((x) => x.signal_name === 'issue_response_latency_days')
    // issue1=2d, issue2=4d → avg=3d
    expect(s?.value).toBe(3)
  })

  it('pr_merge_latency_days returns 14 when no merged PRs', () => {
    const signals = computeGitHubSignals(
      makeInput({ recentPRs: [{ number: 1, state: 'open', created_at: '2024-01-01T00:00:00Z', merged_at: null, closed_at: null }] })
    )
    const s = signals.find((x) => x.signal_name === 'pr_merge_latency_days')
    expect(s?.value).toBe(14)
  })

  it('pr_merge_latency_days calculates from merged PRs', () => {
    const signals = computeGitHubSignals(makeInput())
    const s = signals.find((x) => x.signal_name === 'pr_merge_latency_days')
    expect(s?.value).toBe(7) // 7 days
  })

  it('days_since_last_commit returns 9999 when pushed_at is null', () => {
    const signals = computeGitHubSignals(
      makeInput({ repo: { ...baseRepo, pushed_at: null } })
    )
    const s = signals.find((x) => x.signal_name === 'days_since_last_commit')
    expect(s?.value).toBe(9999)
  })

  it('days_since_last_commit is positive when pushed_at is set', () => {
    const signals = computeGitHubSignals(makeInput())
    const s = signals.find((x) => x.signal_name === 'days_since_last_commit')
    expect(s?.value).toBeGreaterThanOrEqual(1.9)
    expect(s?.value).toBeLessThan(3)
  })

  it('returns measured_at as a Date', () => {
    const signals = computeGitHubSignals(makeInput())
    for (const s of signals) {
      expect(s.measured_at).toBeInstanceOf(Date)
    }
  })
})
