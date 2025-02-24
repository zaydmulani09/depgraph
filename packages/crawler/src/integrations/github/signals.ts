import type { SignalName } from '@depgraph/db'
import type { GitHubWeeklyCommit, GitHubContributor, GitHubIssue, GitHubPR, GitHubRepo } from './client'

export interface GitHubSignalInput {
  weeklyCommits: GitHubWeeklyCommit[]
  contributors: GitHubContributor[]
  recentIssues: GitHubIssue[]
  recentPRs: GitHubPR[]
  repo: GitHubRepo
}

export interface ComputedSignal {
  signal_name: SignalName
  value: number
  measured_at: Date
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function computeGitHubSignals(input: GitHubSignalInput): ComputedSignal[] {
  const { weeklyCommits, contributors, recentIssues, recentPRs, repo } = input
  const now = new Date()

  const results: ComputedSignal[] = []
  const add = (signal_name: SignalName, value: number) =>
    results.push({ signal_name, value, measured_at: now })

  // commit_frequency_30d — last 4 weeks
  const last4 = weeklyCommits.slice(-4)
  add('commit_frequency_30d', round1(last4.reduce((s, w) => s + w.total, 0)))

  // commit_frequency_90d — last 13 weeks
  const last13 = weeklyCommits.slice(-13)
  add('commit_frequency_90d', round1(last13.reduce((s, w) => s + w.total, 0)))

  // days_since_last_commit
  if (!repo.pushed_at) {
    add('days_since_last_commit', 9999)
  } else {
    const diffMs = now.getTime() - new Date(repo.pushed_at).getTime()
    add('days_since_last_commit', round1(diffMs / (1000 * 60 * 60 * 24)))
  }

  // active_maintainer_count — contributors with ≥1 commit in last 13 weeks
  // We approximate: count contributors whose total contributions > 0 (capped at 10 if we only have summary data)
  if (contributors.length > 0) {
    // Use contributor list as proxy — each contributor with >0 commits considered active
    const active = Math.min(contributors.filter((c) => c.contributions > 0).length, 10)
    add('active_maintainer_count', active)
  } else {
    add('active_maintainer_count', 0)
  }

  // bus_factor — contributors whose cumulative contributions = top 50% of total
  if (contributors.length === 0) {
    add('bus_factor', 1)
  } else {
    const sorted = [...contributors].sort((a, b) => b.contributions - a.contributions)
    const total = sorted.reduce((s, c) => s + c.contributions, 0)
    const half = total / 2
    let cumul = 0
    let busFactor = 0
    for (const c of sorted) {
      cumul += c.contributions
      busFactor++
      if (cumul >= half) break
    }
    add('bus_factor', Math.max(1, busFactor))
  }

  // issue_response_latency_days
  const closedIssues = recentIssues.filter((i) => i.closed_at !== null)
  if (closedIssues.length === 0) {
    add('issue_response_latency_days', 30)
  } else {
    const avgHours =
      closedIssues.reduce((s, i) => {
        const ms = new Date(i.closed_at!).getTime() - new Date(i.created_at).getTime()
        return s + ms / (1000 * 60 * 60)
      }, 0) / closedIssues.length
    add('issue_response_latency_days', round1(avgHours / 24))
  }

  // pr_merge_latency_days
  const mergedPRs = recentPRs.filter((p) => p.merged_at !== null)
  if (mergedPRs.length === 0) {
    add('pr_merge_latency_days', 14)
  } else {
    const avgHours =
      mergedPRs.reduce((s, p) => {
        const ms = new Date(p.merged_at!).getTime() - new Date(p.created_at).getTime()
        return s + ms / (1000 * 60 * 60)
      }, 0) / mergedPRs.length
    add('pr_merge_latency_days', round1(avgHours / 24))
  }

  return results
}
