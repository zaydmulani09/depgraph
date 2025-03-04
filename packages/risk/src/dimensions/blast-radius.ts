import type { RiskInput, DimensionScore, Explanation } from '../types'

const DIM = 'blast_radius'

export function scoreBlastRadiusDimension(input: RiskInput): DimensionScore {
  const { dependentCount, transitiveDepth } = input

  // Factor 1: dependent count (weight 60%)
  let f1 = 0
  if (dependentCount === 0) f1 = 0
  else if (dependentCount <= 10) f1 = 10
  else if (dependentCount <= 100) f1 = 30
  else if (dependentCount <= 1000) f1 = 60
  else if (dependentCount <= 10000) f1 = 85
  else f1 = 100

  // Factor 2: transitive depth (weight 40%)
  let f2 = 0
  if (transitiveDepth === 0) f2 = 0
  else if (transitiveDepth === 1) f2 = 10
  else if (transitiveDepth === 2) f2 = 25
  else if (transitiveDepth === 3) f2 = 45
  else if (transitiveDepth === 4) f2 = 65
  else f2 = 85

  const score = f1 * 0.60 + f2 * 0.40

  const explanations: Explanation[] = [
    {
      factor_name: 'dependent_count',
      dimension: DIM,
      contribution_pct: 60,
      raw_value: dependentCount,
      description: `${dependentCount} downstream dependent${dependentCount === 1 ? '' : 's'}`,
    },
    {
      factor_name: 'transitive_depth',
      dimension: DIM,
      contribution_pct: 40,
      raw_value: transitiveDepth,
      description: `Appears at depth ${transitiveDepth} in consumer graph`,
    },
  ]

  return { score, explanations }
}
