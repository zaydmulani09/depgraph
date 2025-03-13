export type CompositeScoreCondition = {
  type: 'composite_score'
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
  value: number
}

export type DimensionScoreCondition = {
  type: 'dimension_score'
  dimension: 'security' | 'maintenance' | 'compatibility' | 'concentration' | 'blast_radius' | 'operational'
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
  value: number
}

export type MaintainerCountCondition = {
  type: 'maintainer_count'
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
  value: number
}

export type DaysSinceReleaseCondition = {
  type: 'days_since_release'
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
  value: number
}

export type AdvisoryCountCondition = {
  type: 'advisory_count'
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
  value: number
  severity?: 'critical' | 'high' | 'medium' | 'low'
}

export type BusFactorCondition = {
  type: 'bus_factor'
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
  value: number
}

export type DependentCountCondition = {
  type: 'dependent_count'
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
  value: number
}

export type EcosystemCondition = {
  type: 'ecosystem'
  value: 'npm' | 'pypi' | 'cargo'
}

export type AndCondition = {
  type: 'and'
  conditions: PolicyCondition[]
}

export type OrCondition = {
  type: 'or'
  conditions: PolicyCondition[]
}

export type NotCondition = {
  type: 'not'
  condition: PolicyCondition
}

export type PolicyCondition =
  | CompositeScoreCondition
  | DimensionScoreCondition
  | MaintainerCountCondition
  | DaysSinceReleaseCondition
  | AdvisoryCountCondition
  | BusFactorCondition
  | DependentCountCondition
  | EcosystemCondition
  | AndCondition
  | OrCondition
  | NotCondition

export type PolicyAction = 'block' | 'warn' | 'require_approval'

export interface PolicyRule {
  id: string
  name: string
  description: string | null
  action: PolicyAction
  condition: PolicyCondition
  is_enabled: boolean
}

export interface PolicyViolationResult {
  ruleId: string
  ruleName: string
  action: PolicyAction
  packageId: string
  packageName: string
  remediation: string
  matchedCondition: string
}
