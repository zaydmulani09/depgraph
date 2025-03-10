import type {
  SnapshotData,
  SnapshotDiff,
  SnapshotDiffEntry,
  SnapshotPackageEntry,
  VulnerabilityChain,
} from './types'

const DIMENSIONS: Array<{
  key: keyof SnapshotPackageEntry
  name: string
}> = [
  { key: 'securityScore', name: 'security' },
  { key: 'maintenanceScore', name: 'maintenance' },
  { key: 'compatibilityScore', name: 'compatibility' },
  { key: 'concentrationScore', name: 'concentration' },
  { key: 'blastRadiusScore', name: 'blast_radius' },
  { key: 'operationalScore', name: 'operational' },
]

export function diffSnapshots(
  previous: SnapshotData,
  current: SnapshotData,
  previousSnapshotId: string,
  currentSnapshotId: string,
  options?: {
    scoreChangThreshold?: number
  }
): SnapshotDiff {
  const threshold = options?.scoreChangThreshold ?? 2.0

  const prevMap = new Map<string, SnapshotPackageEntry>(
    previous.packages.map((p) => [p.packageId, p])
  )
  const currMap = new Map<string, SnapshotPackageEntry>(
    current.packages.map((p) => [p.packageId, p])
  )

  const added: SnapshotPackageEntry[] = []
  const removed: SnapshotPackageEntry[] = []
  const improved: SnapshotDiffEntry[] = []
  const degraded: SnapshotDiffEntry[] = []
  const unchanged: string[] = []
  const newVulnerabilityChains: VulnerabilityChain[] = []

  // Added
  for (const [id, entry] of currMap) {
    if (!prevMap.has(id)) added.push(entry)
  }

  // Removed
  for (const [id, entry] of prevMap) {
    if (!currMap.has(id)) removed.push(entry)
  }

  // Changed / unchanged
  for (const [id, curr] of currMap) {
    const prev = prevMap.get(id)
    if (!prev) continue

    const delta = curr.compositeScore - prev.compositeScore

    const changedDimensions = DIMENSIONS.filter(
      (d) => Math.abs((curr[d.key] as number) - (prev[d.key] as number)) > 5.0
    ).map((d) => d.name)

    if (delta > threshold) {
      const entry: SnapshotDiffEntry = {
        packageId: id,
        packageName: curr.packageName,
        previousScore: prev.compositeScore,
        currentScore: curr.compositeScore,
        delta,
        changedDimensions,
      }
      degraded.push(entry)

      // Vulnerability chain: degraded AND advisoryCount increased
      if (curr.advisoryCount > prev.advisoryCount) {
        newVulnerabilityChains.push({
          packageId: id,
          packageName: curr.packageName,
          advisoryId: 'detected',
          severity: curr.securityScore > 50 ? 'high' : 'medium',
          introducedAt: current.generatedAt,
          affectedDownstreamCount: curr.dependentCount,
        })
      }
    } else if (delta < -threshold) {
      improved.push({
        packageId: id,
        packageName: curr.packageName,
        previousScore: prev.compositeScore,
        currentScore: curr.compositeScore,
        delta,
        changedDimensions,
      })
    } else {
      unchanged.push(id)
    }
  }

  return {
    previousSnapshotId,
    currentSnapshotId,
    previousGeneratedAt: previous.generatedAt,
    currentGeneratedAt: current.generatedAt,
    added,
    removed,
    improved,
    degraded,
    unchanged,
    newVulnerabilityChains,
  }
}
