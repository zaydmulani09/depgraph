import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { diffSnapshots } from '../snapshots/differ'
import { getSnapshot, listSnapshots } from '../snapshots/persister'
import type { DepgraphAlert, AlertSeverity } from './types'

export interface DriftDetectionResult {
  alerts: DepgraphAlert[]
  baselineSnapshotId: string | null
  currentSnapshotId: string
  baselineDaysAgo: number
}

interface DriftDetectionOptions {
  baselineDays?: number
  scoreSpikeThreshold?: number
  maintenanceDeltaThreshold?: number
}

export async function detectDrift(
  db: any,
  currentSnapshotId: string,
  options: DriftDetectionOptions = {}
): Promise<DriftDetectionResult> {
  const {
    baselineDays = 7,
    scoreSpikeThreshold = 15,
    maintenanceDeltaThreshold = 20,
  } = options

  const baselineDate = new Date(Date.now() - baselineDays * 24 * 60 * 60 * 1000)
  const baselineSnaps = await listSnapshots(db, { before: baselineDate, limit: 1 })

  if (baselineSnaps.length === 0) {
    return { alerts: [], baselineSnapshotId: null, currentSnapshotId, baselineDaysAgo: baselineDays }
  }

  const baselineSnap = baselineSnaps[0]
  const [baseline, current] = await Promise.all([
    getSnapshot(db, baselineSnap.id),
    getSnapshot(db, currentSnapshotId),
  ])

  if (!baseline || !current) {
    return { alerts: [], baselineSnapshotId: baselineSnap.id, currentSnapshotId, baselineDaysAgo: baselineDays }
  }

  const diff = diffSnapshots(baseline, current, baselineSnap.id, currentSnapshotId)
  const now = new Date().toISOString()
  const alerts: DepgraphAlert[] = []

  // Build lookup map for current snapshot entries
  const currentMap = new Map(current.packages.map((p) => [p.packageId, p]))
  const baselineMap = new Map(baseline.packages.map((p) => [p.packageId, p]))

  // new_vulnerability alerts
  for (const chain of diff.newVulnerabilityChains) {
    const severity: AlertSeverity = chain.severity === 'critical' || chain.severity === 'high'
      ? 'high'
      : 'medium'
    const pkg = currentMap.get(chain.packageId)
    alerts.push({
      id: randomUUID(),
      type: 'new_vulnerability',
      severity,
      packageId: chain.packageId,
      packageName: chain.packageName,
      ecosystem: pkg?.ecosystem ?? null,
      title: `New vulnerability detected in ${chain.packageName}`,
      message: `Advisory ${chain.advisoryId} affects ${chain.packageName} with ${chain.affectedDownstreamCount} downstream dependents.`,
      metadata: {
        advisoryId: chain.advisoryId,
        chainSeverity: chain.severity,
        affectedDownstreamCount: chain.affectedDownstreamCount,
      },
      snapshotId: currentSnapshotId,
      createdAt: now,
      deduplicationKey: `new_vulnerability:${chain.packageId}:${chain.advisoryId}`,
    })
  }

  // score_spike + maintainer_collapse alerts
  for (const entry of diff.degraded) {
    const delta = Math.abs(entry.delta)
    const pkg = currentMap.get(entry.packageId)
    const baselinePkg = baselineMap.get(entry.packageId)

    // score_spike
    if (delta >= scoreSpikeThreshold) {
      const severity: AlertSeverity = delta >= 30 ? 'critical' : delta >= 20 ? 'high' : 'medium'
      const bucket = Math.floor(delta / 10) * 10
      alerts.push({
        id: randomUUID(),
        type: 'score_spike',
        severity,
        packageId: entry.packageId,
        packageName: entry.packageName,
        ecosystem: pkg?.ecosystem ?? null,
        title: `Risk score spike for ${entry.packageName}`,
        message: `Composite score increased by ${delta.toFixed(1)} points (${entry.previousScore.toFixed(1)} → ${entry.currentScore.toFixed(1)}).`,
        metadata: {
          previousScore: entry.previousScore,
          currentScore: entry.currentScore,
          delta,
          changedDimensions: entry.changedDimensions,
        },
        snapshotId: currentSnapshotId,
        createdAt: now,
        deduplicationKey: `score_spike:${entry.packageId}:${bucket}`,
      })
    }

    // maintainer_collapse
    if (
      entry.changedDimensions.includes('maintenance') &&
      pkg != null &&
      baselinePkg != null
    ) {
      const maintDelta = Math.abs(pkg.maintenanceScore - baselinePkg.maintenanceScore)
      if (maintDelta > maintenanceDeltaThreshold) {
        alerts.push({
          id: randomUUID(),
          type: 'maintainer_collapse',
          severity: 'critical',
          packageId: entry.packageId,
          packageName: entry.packageName,
          ecosystem: pkg.ecosystem ?? null,
          title: `Maintainer activity collapse for ${entry.packageName}`,
          message: `Maintenance score dropped by ${maintDelta.toFixed(1)} points over ${baselineDays} days (${baselinePkg.maintenanceScore.toFixed(1)} → ${pkg.maintenanceScore.toFixed(1)}).`,
          metadata: {
            previousMaintenanceScore: baselinePkg.maintenanceScore,
            currentMaintenanceScore: pkg.maintenanceScore,
            maintDelta,
            maintainerCount: pkg.maintainerCount,
          },
          snapshotId: currentSnapshotId,
          createdAt: now,
          deduplicationKey: `maintainer_collapse:${entry.packageId}`,
        })
      }
    }
  }

  // bus_factor_one alerts — query packages with bus_factor signal = 1 among degraded
  const degradedIds = diff.degraded.map((e) => e.packageId)
  if (degradedIds.length > 0) {
    const idList = degradedIds.map((id) => `'${id}'`).join(', ')
    const result = await db.execute(sql.raw(`
      SELECT DISTINCT p.id, p.name, p.ecosystem
      FROM packages p
      JOIN package_signals ps ON ps.package_id = p.id
      WHERE p.id IN (${idList})
        AND ps.signal_name = 'bus_factor'
        AND ps.value = 1
    `))
    const rows = (result.rows ?? result) as Array<{ id: string; name: string; ecosystem: string }>
    for (const row of rows) {
      alerts.push({
        id: randomUUID(),
        type: 'bus_factor_one',
        severity: 'high',
        packageId: row.id,
        packageName: row.name,
        ecosystem: row.ecosystem,
        title: `Bus factor of 1 detected for ${row.name}`,
        message: `${row.name} has a single active maintainer and its risk score is degrading.`,
        metadata: { ecosystem: row.ecosystem },
        snapshotId: currentSnapshotId,
        createdAt: now,
        deduplicationKey: `bus_factor_one:${row.id}`,
      })
    }
  }

  return {
    alerts,
    baselineSnapshotId: baselineSnap.id,
    currentSnapshotId,
    baselineDaysAgo: baselineDays,
  }
}
