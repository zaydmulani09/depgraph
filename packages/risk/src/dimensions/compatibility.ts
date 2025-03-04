import type { RiskInput, DimensionScore, Explanation } from '../types'

const DIM = 'compatibility'

export function scoreCompatibilityDimension(input: RiskInput): DimensionScore {
  const { signals, versionsCount } = input

  // Factor 1: semver violation rate (weight 50%)
  const svRate = signals['semver_violation_rate'] ?? 0
  const f1 = Math.min(100, svRate * 100)

  // Factor 2: release cadence volatility (weight 30%)
  const cadence = signals['release_cadence_days'] ?? 30
  let f2 = 0
  if (cadence < 7) f2 = 70
  else if (cadence <= 30) f2 = 10
  else if (cadence <= 90) f2 = 0
  else if (cadence <= 365) f2 = 20
  else f2 = 60

  // Factor 3: version count as maturity proxy (weight 20%)
  let f3 = 0
  if (versionsCount <= 2) f3 = 60
  else if (versionsCount <= 10) f3 = 20
  else if (versionsCount <= 50) f3 = 0
  else f3 = 10

  const score = f1 * 0.50 + f2 * 0.30 + f3 * 0.20

  const explanations: Explanation[] = [
    {
      factor_name: 'semver_violation_rate',
      dimension: DIM,
      contribution_pct: 50,
      raw_value: svRate,
      description: `Semver violation rate: ${(svRate * 100).toFixed(1)}%`,
    },
    {
      factor_name: 'release_cadence',
      dimension: DIM,
      contribution_pct: 30,
      raw_value: cadence,
      description: `Average release cadence: ${Math.round(cadence)} days`,
    },
    {
      factor_name: 'version_count',
      dimension: DIM,
      contribution_pct: 20,
      raw_value: versionsCount,
      description: `${versionsCount} published version${versionsCount === 1 ? '' : 's'}`,
    },
  ]

  return { score, explanations }
}
