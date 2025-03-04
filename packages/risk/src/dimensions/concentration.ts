import type { RiskInput, DimensionScore, Explanation } from '../types'

const DIM = 'concentration'

export function scoreConcentrationDimension(input: RiskInput): DimensionScore {
  const { signals } = input

  // Factor 1: bus factor (weight 60%)
  const busFactor = signals['bus_factor'] ?? 1
  let f1 = 0
  if (busFactor === 1) f1 = 100
  else if (busFactor === 2) f1 = 50
  else if (busFactor === 3) f1 = 20
  else f1 = 0

  // Factor 2: active maintainer count (weight 40%)
  const maintCount = signals['active_maintainer_count'] ?? 1
  let f2 = 0
  if (maintCount === 1) f2 = 80
  else if (maintCount === 2) f2 = 40
  else if (maintCount === 3) f2 = 15
  else f2 = 0

  const score = f1 * 0.60 + f2 * 0.40

  const explanations: Explanation[] = [
    {
      factor_name: 'bus_factor_concentration',
      dimension: DIM,
      contribution_pct: 60,
      raw_value: busFactor,
      description: `Single point of failure: bus factor ${busFactor}`,
    },
    {
      factor_name: 'maintainer_concentration',
      dimension: DIM,
      contribution_pct: 40,
      raw_value: maintCount,
      description: `${maintCount} active maintainer${maintCount === 1 ? '' : 's'} — concentration risk`,
    },
  ]

  return { score, explanations }
}
