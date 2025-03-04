import type { RiskInput, DimensionScore, Explanation } from '../types'

const DIM = 'maintenance'

export function scoreMaintenanceDimension(input: RiskInput): DimensionScore {
  const { signals } = input

  // Factor 1: days since last commit (weight 35%)
  const daysSinceCommit = signals['days_since_last_commit'] ?? 365
  let f1 = 0
  if (daysSinceCommit <= 30) f1 = 0
  else if (daysSinceCommit <= 90) f1 = 20
  else if (daysSinceCommit <= 180) f1 = 45
  else if (daysSinceCommit <= 365) f1 = 70
  else f1 = 100

  // Factor 2: days since last release (weight 25%)
  const daysSinceRelease = signals['days_since_last_release'] ?? 365
  let f2 = 0
  if (daysSinceRelease <= 60) f2 = 0
  else if (daysSinceRelease <= 180) f2 = 20
  else if (daysSinceRelease <= 365) f2 = 50
  else if (daysSinceRelease <= 730) f2 = 75
  else f2 = 100

  // Factor 3: active maintainer count (weight 25%)
  const maintCount = signals['active_maintainer_count'] ?? 1
  let f3 = 0
  if (maintCount >= 5) f3 = 0
  else if (maintCount >= 3) f3 = 15
  else if (maintCount === 2) f3 = 35
  else if (maintCount === 1) f3 = 70
  else f3 = 100

  // Factor 4: bus factor (weight 15%)
  const busFactor = signals['bus_factor'] ?? 1
  let f4 = 0
  if (busFactor >= 3) f4 = 0
  else if (busFactor === 2) f4 = 25
  else f4 = 80 // 1 or less

  const score = f1 * 0.35 + f2 * 0.25 + f3 * 0.25 + f4 * 0.15

  const explanations: Explanation[] = [
    {
      factor_name: 'days_since_last_commit',
      dimension: DIM,
      contribution_pct: 35,
      raw_value: daysSinceCommit,
      description: `Last commit ${Math.round(daysSinceCommit)} days ago`,
    },
    {
      factor_name: 'days_since_last_release',
      dimension: DIM,
      contribution_pct: 25,
      raw_value: daysSinceRelease,
      description: `Last release ${Math.round(daysSinceRelease)} days ago`,
    },
    {
      factor_name: 'active_maintainer_count',
      dimension: DIM,
      contribution_pct: 25,
      raw_value: maintCount,
      description: `${maintCount} active maintainer${maintCount === 1 ? '' : 's'}`,
    },
    {
      factor_name: 'bus_factor',
      dimension: DIM,
      contribution_pct: 15,
      raw_value: busFactor,
      description: `Bus factor: ${busFactor}`,
    },
  ]

  return { score, explanations }
}
