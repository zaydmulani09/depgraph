import type { RiskInput, RiskScoreResult, Explanation } from './types'
import { scoreSecurityDimension } from './dimensions/security'
import { scoreMaintenanceDimension } from './dimensions/maintenance'
import { scoreCompatibilityDimension } from './dimensions/compatibility'
import { scoreConcentrationDimension } from './dimensions/concentration'
import { scoreBlastRadiusDimension } from './dimensions/blast-radius'
import { scoreOperationalDimension } from './dimensions/operational'

const DIM_WEIGHTS: Record<string, number> = {
  security: 30,
  maintenance: 25,
  blast_radius: 20,
  concentration: 10,
  compatibility: 10,
  operational: 5,
}

export function aggregateRiskScore(input: RiskInput): RiskScoreResult {
  const security = scoreSecurityDimension(input)
  const maintenance = scoreMaintenanceDimension(input)
  const compatibility = scoreCompatibilityDimension(input)
  const concentration = scoreConcentrationDimension(input)
  const blast_radius = scoreBlastRadiusDimension(input)
  const operational = scoreOperationalDimension(input)

  const composite =
    Math.round(
      (security.score * 0.30 +
        maintenance.score * 0.25 +
        blast_radius.score * 0.20 +
        concentration.score * 0.10 +
        compatibility.score * 0.10 +
        operational.score * 0.05) * 10
    ) / 10

  const allDimensions: Array<{ name: string; result: typeof security }> = [
    { name: 'security', result: security },
    { name: 'maintenance', result: maintenance },
    { name: 'compatibility', result: compatibility },
    { name: 'concentration', result: concentration },
    { name: 'blast_radius', result: blast_radius },
    { name: 'operational', result: operational },
  ]

  const explanations: Explanation[] = []
  for (const { name, result } of allDimensions) {
    const dimWeight = DIM_WEIGHTS[name] ?? 0
    for (const exp of result.explanations) {
      explanations.push({
        ...exp,
        contribution_pct: Math.round((exp.contribution_pct * dimWeight / 100) * 10) / 10,
      })
    }
  }

  return {
    packageId: input.packageId,
    security,
    maintenance,
    compatibility,
    concentration,
    blast_radius,
    operational,
    composite,
    explanations,
  }
}
