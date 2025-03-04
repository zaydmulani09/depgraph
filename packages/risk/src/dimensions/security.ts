import type { RiskInput, DimensionScore, Explanation } from '../types'

const DIM = 'security'

export function scoreSecurityDimension(input: RiskInput): DimensionScore {
  const active = input.advisories.filter((a) => a.withdrawn_at === null)
  const critical = active.filter((a) => a.severity === 'critical').length
  const high = active.filter((a) => a.severity === 'high').length
  const total = active.length
  const maxCvss = active.reduce((m, a) => Math.max(m, a.cvss_score ?? 0), 0)

  // Factor 1: critical advisories (weight 45%)
  let f1 = 0
  if (critical === 1) f1 = 60
  else if (critical === 2) f1 = 80
  else if (critical >= 3) f1 = 100

  // Factor 2: high advisories (weight 30%)
  let f2 = 0
  if (high === 1) f2 = 40
  else if (high === 2) f2 = 65
  else if (high >= 3) f2 = 90

  // Factor 3: total active advisories (weight 15%)
  let f3 = 0
  if (total >= 1 && total <= 2) f3 = 20
  else if (total >= 3 && total <= 5) f3 = 50
  else if (total >= 6) f3 = 80

  // Factor 4: max CVSS score (weight 10%)
  const f4 = (maxCvss / 10) * 100

  const score = f1 * 0.45 + f2 * 0.30 + f3 * 0.15 + f4 * 0.10

  const explanations: Explanation[] = [
    {
      factor_name: 'critical_advisories',
      dimension: DIM,
      contribution_pct: 45,
      raw_value: critical,
      description: `${critical} active critical advisor${critical === 1 ? 'y' : 'ies'}`,
    },
    {
      factor_name: 'high_advisories',
      dimension: DIM,
      contribution_pct: 30,
      raw_value: high,
      description: `${high} active high-severity advisor${high === 1 ? 'y' : 'ies'}`,
    },
    {
      factor_name: 'total_advisories',
      dimension: DIM,
      contribution_pct: 15,
      raw_value: total,
      description: `${total} total open advisor${total === 1 ? 'y' : 'ies'}`,
    },
    {
      factor_name: 'max_cvss',
      dimension: DIM,
      contribution_pct: 10,
      raw_value: maxCvss,
      description: `Highest CVSS score: ${maxCvss.toFixed(1)}`,
    },
  ]

  return { score, explanations }
}
