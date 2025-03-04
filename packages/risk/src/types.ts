import type { SignalName } from '@depgraph/db'

export interface RiskInput {
  packageId: string
  packageName: string
  ecosystem: 'npm' | 'pypi' | 'cargo'
  signals: SignalMap
  advisories: AdvisoryInput[]
  dependentCount: number
  transitiveDepth: number
  maintainerCount: number
  versionsCount: number
}

export type SignalMap = Partial<Record<SignalName, number>>

export interface AdvisoryInput {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown'
  cvss_score: number | null
  withdrawn_at: Date | null
}

export interface DimensionScore {
  score: number
  explanations: Explanation[]
}

export interface Explanation {
  factor_name: string
  dimension: string
  contribution_pct: number
  raw_value: number | null
  description: string
}

export interface RiskScoreResult {
  packageId: string
  security: DimensionScore
  maintenance: DimensionScore
  compatibility: DimensionScore
  concentration: DimensionScore
  blast_radius: DimensionScore
  operational: DimensionScore
  composite: number
  explanations: Explanation[]
}
