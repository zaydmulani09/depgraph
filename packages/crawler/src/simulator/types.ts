export type SemverCompatibility = 'patch' | 'minor' | 'major' | 'unknown'

export type BreakingRisk = 'none' | 'low' | 'medium' | 'high'

export interface VersionInfo {
  version: string
  publishedAt: Date | null
  deprecated: boolean
  hasTypes: boolean
  license: string | null
}

export interface TransitiveDiff {
  packageId: string
  packageName: string
  ecosystem: string
  changeType: 'added' | 'removed' | 'version_changed'
  fromVersion: string | null
  toVersion: string | null
  depth: number
}

export interface ScoreDiff {
  dimension: string
  fromScore: number
  toScore: number
  delta: number
}

export interface SimulationResult {
  packageId: string
  packageName: string
  ecosystem: string
  fromVersion: string
  toVersion: string
  semverCompatibility: SemverCompatibility
  breakingRisk: BreakingRisk
  fromCompositeScore: number
  toCompositeScore: number
  compositeDelta: number
  dimensionDiffs: ScoreDiff[]
  transitiveDiffs: TransitiveDiff[]
  affectedDownstreamCount: number
  availableVersions: VersionInfo[]
  simulatedAt: string
  warnings: string[]
}
