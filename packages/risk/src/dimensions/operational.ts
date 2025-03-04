import type { RiskInput, DimensionScore, Explanation } from '../types'

const DIM = 'operational'

export function scoreOperationalDimension(input: RiskInput): DimensionScore {
  const { signals } = input

  // Factor 1: commit frequency 30d (weight 40%)
  const commits30d = signals['commit_frequency_30d'] ?? 0
  let f1 = 0
  if (commits30d >= 20) f1 = 0
  else if (commits30d >= 10) f1 = 10
  else if (commits30d >= 5) f1 = 25
  else if (commits30d >= 1) f1 = 50
  else f1 = 80

  // Factor 2: issue response latency (weight 35%)
  const issueLatency = signals['issue_response_latency_days'] ?? 30
  let f2 = 0
  if (issueLatency < 1) f2 = 0
  else if (issueLatency <= 3) f2 = 10
  else if (issueLatency <= 7) f2 = 25
  else if (issueLatency <= 14) f2 = 45
  else if (issueLatency <= 30) f2 = 65
  else f2 = 90

  // Factor 3: PR merge latency (weight 25%)
  const prLatency = signals['pr_merge_latency_days'] ?? 14
  let f3 = 0
  if (prLatency < 3) f3 = 0
  else if (prLatency <= 7) f3 = 15
  else if (prLatency <= 14) f3 = 30
  else if (prLatency <= 30) f3 = 55
  else f3 = 85

  const score = f1 * 0.40 + f2 * 0.35 + f3 * 0.25

  const explanations: Explanation[] = [
    {
      factor_name: 'commit_frequency_30d',
      dimension: DIM,
      contribution_pct: 40,
      raw_value: commits30d,
      description: `${Math.round(commits30d)} commit${commits30d === 1 ? '' : 's'} in last 30 days`,
    },
    {
      factor_name: 'issue_response_latency',
      dimension: DIM,
      contribution_pct: 35,
      raw_value: issueLatency,
      description: `Average issue response: ${issueLatency.toFixed(1)} days`,
    },
    {
      factor_name: 'pr_merge_latency',
      dimension: DIM,
      contribution_pct: 25,
      raw_value: prLatency,
      description: `Average PR merge time: ${prLatency.toFixed(1)} days`,
    },
  ]

  return { score, explanations }
}
