import type { PolicyCondition } from './types'
import type { SnapshotPackageEntry } from '../snapshots/types'

const DIMENSION_TO_FIELD: Record<string, keyof SnapshotPackageEntry> = {
  security: 'securityScore',
  maintenance: 'maintenanceScore',
  compatibility: 'compatibilityScore',
  concentration: 'concentrationScore',
  blast_radius: 'blastRadiusScore',
  operational: 'operationalScore',
}

export function applyOperator(actual: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case 'gt':  return actual > threshold
    case 'gte': return actual >= threshold
    case 'lt':  return actual < threshold
    case 'lte': return actual <= threshold
    case 'eq':  return actual === threshold
    default:    return false
  }
}

export function evaluateCondition(
  condition: PolicyCondition,
  entry: SnapshotPackageEntry,
  signals?: Partial<Record<string, number>>
): boolean {
  switch (condition.type) {
    case 'composite_score':
      return applyOperator(entry.compositeScore, condition.operator, condition.value)

    case 'dimension_score': {
      const field = DIMENSION_TO_FIELD[condition.dimension]
      const actual = (entry[field] as number) ?? 0
      return applyOperator(actual, condition.operator, condition.value)
    }

    case 'maintainer_count':
      return applyOperator(entry.maintainerCount, condition.operator, condition.value)

    case 'days_since_release': {
      const days = signals?.days_since_last_release ?? 999
      return applyOperator(days, condition.operator, condition.value)
    }

    case 'advisory_count': {
      if (condition.severity) {
        console.warn(
          `[evaluator] advisory_count with severity filter '${condition.severity}' ` +
            'not supported at snapshot layer — condition passes by default'
        )
        return true
      }
      return applyOperator(entry.advisoryCount, condition.operator, condition.value)
    }

    case 'bus_factor': {
      const bf = signals?.bus_factor ?? 1
      return applyOperator(bf, condition.operator, condition.value)
    }

    case 'dependent_count':
      return applyOperator(entry.dependentCount, condition.operator, condition.value)

    case 'ecosystem':
      return entry.ecosystem === condition.value

    case 'and':
      return condition.conditions.every((c) => evaluateCondition(c, entry, signals))

    case 'or':
      return condition.conditions.some((c) => evaluateCondition(c, entry, signals))

    case 'not':
      return !evaluateCondition(condition.condition, entry, signals)

    default:
      return false
  }
}
