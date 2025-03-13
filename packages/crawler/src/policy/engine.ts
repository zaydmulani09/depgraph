import type { PolicyRule, PolicyCondition, PolicyViolationResult } from './types'
import type { SnapshotPackageEntry } from '../snapshots/types'
import { evaluateCondition } from './evaluator'
import { generateRemediation } from './remediation'

const ACTION_ORDER: Record<string, number> = {
  block: 0,
  require_approval: 1,
  warn: 2,
}

const OP_SYMBOL: Record<string, string> = {
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  eq: '==',
}

export function summarizeCondition(
  condition: PolicyCondition,
  entry: SnapshotPackageEntry
): string {
  switch (condition.type) {
    case 'composite_score':
      return `composite_score ${entry.compositeScore} ${OP_SYMBOL[condition.operator]} ${condition.value}`

    case 'dimension_score': {
      const fieldMap: Record<string, keyof SnapshotPackageEntry> = {
        security: 'securityScore',
        maintenance: 'maintenanceScore',
        compatibility: 'compatibilityScore',
        concentration: 'concentrationScore',
        blast_radius: 'blastRadiusScore',
        operational: 'operationalScore',
      }
      const actual = entry[fieldMap[condition.dimension]] as number ?? 0
      return `${condition.dimension}_score ${actual} ${OP_SYMBOL[condition.operator]} ${condition.value}`
    }

    case 'maintainer_count':
      return `maintainer_count ${entry.maintainerCount} ${OP_SYMBOL[condition.operator]} ${condition.value}`

    case 'days_since_release':
      return `days_since_release ? ${OP_SYMBOL[condition.operator]} ${condition.value}`

    case 'advisory_count':
      return `advisory_count ${entry.advisoryCount} ${OP_SYMBOL[condition.operator]} ${condition.value}`

    case 'bus_factor':
      return `bus_factor ? ${OP_SYMBOL[condition.operator]} ${condition.value}`

    case 'dependent_count':
      return `dependent_count ${entry.dependentCount} ${OP_SYMBOL[condition.operator]} ${condition.value}`

    case 'ecosystem':
      return `ecosystem == ${condition.value}`

    case 'and':
      return condition.conditions.map((c) => summarizeCondition(c, entry)).join(' AND ')

    case 'or':
      return condition.conditions.map((c) => summarizeCondition(c, entry)).join(' OR ')

    case 'not':
      return `NOT (${summarizeCondition(condition.condition, entry)})`

    default:
      return 'unknown condition'
  }
}

export function evaluateRules(
  rules: PolicyRule[],
  packages: SnapshotPackageEntry[],
  signals?: Map<string, Partial<Record<string, number>>>
): PolicyViolationResult[] {
  const violations: PolicyViolationResult[] = []

  for (const entry of packages) {
    const pkgSignals = signals?.get(entry.packageId)

    for (const rule of rules) {
      const matched = evaluateCondition(rule.condition, entry, pkgSignals)
      if (!matched) continue

      violations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        action: rule.action,
        packageId: entry.packageId,
        packageName: entry.packageName,
        remediation: generateRemediation(rule, entry),
        matchedCondition: summarizeCondition(rule.condition, entry),
      })
    }
  }

  return violations.sort(
    (a, b) => (ACTION_ORDER[a.action] ?? 9) - (ACTION_ORDER[b.action] ?? 9)
  )
}
