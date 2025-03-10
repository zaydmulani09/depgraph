export interface SnapshotPackageEntry {
  packageId: string
  packageName: string
  ecosystem: string
  compositeScore: number
  securityScore: number
  maintenanceScore: number
  compatibilityScore: number
  concentrationScore: number
  blastRadiusScore: number
  operationalScore: number
  advisoryCount: number
  maintainerCount: number
  dependentCount: number
  topExplanations: Array<{
    factor_name: string
    dimension: string
    contribution_pct: number
    description: string
  }>
}

export interface SnapshotData {
  version: 1
  generatedAt: string
  ecosystem?: string
  repositoryId?: string
  packages: SnapshotPackageEntry[]
  summary: {
    totalPackages: number
    avgCompositeScore: number
    maxCompositeScore: number
    criticalCount: number
    highCount: number
    packagesByEcosystem: Record<string, number>
  }
}

export interface SnapshotDiff {
  previousSnapshotId: string
  currentSnapshotId: string
  previousGeneratedAt: string
  currentGeneratedAt: string
  added: SnapshotPackageEntry[]
  removed: SnapshotPackageEntry[]
  improved: SnapshotDiffEntry[]
  degraded: SnapshotDiffEntry[]
  unchanged: string[]
  newVulnerabilityChains: VulnerabilityChain[]
}

export interface SnapshotDiffEntry {
  packageId: string
  packageName: string
  previousScore: number
  currentScore: number
  delta: number
  changedDimensions: string[]
}

export interface VulnerabilityChain {
  packageId: string
  packageName: string
  advisoryId: string
  severity: string
  introducedAt: string
  affectedDownstreamCount: number
}
