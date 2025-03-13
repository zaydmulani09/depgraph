import type { PolicyRule, PolicyCondition } from './types'
import type { SnapshotPackageEntry } from '../snapshots/types'

function topCondition(condition: PolicyCondition): PolicyCondition {
  if (condition.type === 'and' || condition.type === 'or') {
    return condition.conditions[0] ?? condition
  }
  if (condition.type === 'not') {
    return condition.condition
  }
  return condition
}

export function generateRemediation(rule: PolicyRule, entry: SnapshotPackageEntry): string {
  const cond = topCondition(rule.condition)

  switch (cond.type) {
    case 'composite_score':
      return (
        `Reduce composite risk score from ${entry.compositeScore.toFixed(1)} to below ` +
        `${cond.value} by addressing top risk factors`
      )

    case 'dimension_score':
      return (
        `Improve ${cond.dimension} score ` +
        `(currently ${(entry[({
          security: 'securityScore',
          maintenance: 'maintenanceScore',
          compatibility: 'compatibilityScore',
          concentration: 'concentrationScore',
          blast_radius: 'blastRadiusScore',
          operational: 'operationalScore',
        } as Record<string, keyof SnapshotPackageEntry>)[cond.dimension]] as number ?? 0).toFixed(1)}) ` +
        `— see risk explanations for contributing factors`
      )

    case 'maintainer_count':
      return (
        `Package has ${entry.maintainerCount} maintainer(s) — ` +
        `consider finding an alternative with more active maintainers`
      )

    case 'advisory_count':
      return (
        `Package has ${entry.advisoryCount} open advisories — ` +
        `update to a patched version or apply mitigations`
      )

    case 'bus_factor':
      return `Bus factor is low — this package has a single point of failure risk`

    case 'dependent_count':
      return (
        `Package has ${entry.dependentCount} downstream dependents — ` +
        `any change will have wide blast radius`
      )

    case 'days_since_release':
      return `Package has not been released in over ${cond.value} days — may be abandoned`

    default:
      return `Review package ${entry.packageName} — it violates policy rule '${rule.name}'`
  }
}
