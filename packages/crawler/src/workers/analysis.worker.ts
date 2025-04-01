import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import { getLatestSignals, getSignalHistory } from '../analysis/timeseries'
import { computeTrend } from '../analysis/trend-detector'
import { scoreAbandonment } from '../analysis/abandonment-scorer'
import { detectBusFactorAlerts } from '../analysis/bus-factor-alert'
import { backfillSignalsFromSnapshots } from '../analysis/backfill'
import { riskScoreQueue } from '../queue'

type AnalysisJobPayload =
  | { mode: 'package'; packageId: string; packageName: string }
  | { mode: 'backfill' }
  | { mode: 'bus-factor-scan' }

const PREFIX = '[analysis]'

export function createAnalysisWorker(deps: { redis: Redis; db: unknown }): Worker {
  const { redis, db } = deps

  return new Worker(
    'run-analysis',
    async (job) => {
      const payload = job.data as AnalysisJobPayload

      // ── package mode ────────────────────────────────────────────────────────
      if (payload.mode === 'package') {
        const { packageId, packageName } = payload

        // Fetch latest signals
        const latestSignals = await getLatestSignals(db as any, packageId)

        // Fetch signal histories
        const [commitSeries, maintainerSeries, busSeries] = await Promise.all([
          getSignalHistory(db as any, packageId, 'commit_frequency_30d', 90),
          getSignalHistory(db as any, packageId, 'active_maintainer_count', 90),
          getSignalHistory(db as any, packageId, 'bus_factor', 90),
        ])

        // Compute trends
        const trends = new Map([
          ['commit_frequency_30d', computeTrend(commitSeries)],
          ['active_maintainer_count', computeTrend(maintainerSeries)],
          ['bus_factor', computeTrend(busSeries)],
        ])

        // Score abandonment
        const score = scoreAbandonment(packageId, latestSignals, trends)
        console.log(
          `${PREFIX} ${packageName}: abandonment probability ${score.probability.toFixed(3)}, recommendation: ${score.recommendation}, confidence: ${score.confidence}`
        )

        // Enqueue risk rescore (scorePackage not available — use queue)
        await riskScoreQueue.add('score', { packageId }, { priority: 3 })

        // Bus factor alerts
        const alerts = await detectBusFactorAlerts(db as any, [packageId])
        for (const alert of alerts) {
          if (alert.alertLevel === 'declining_to_one') {
            console.warn(`${PREFIX} ⚠ Bus factor declining to 1 for ${packageName}`)
          } else {
            console.log(
              `${PREFIX} Bus factor alert [${alert.alertLevel}] for ${packageName} (bf=${alert.currentBusFactor})`
            )
          }
        }

        return {
          packageId,
          abandonmentProbability: score.probability,
          recommendation: score.recommendation,
          busFactorAlerts: alerts.length,
        }
      }

      // ── backfill mode ───────────────────────────────────────────────────────
      if (payload.mode === 'backfill') {
        console.log(`${PREFIX} Starting signal backfill from snapshots...`)
        const result = await backfillSignalsFromSnapshots(db as any)
        console.log(
          `${PREFIX} Backfill complete: ${result.snapshotsProcessed} snapshots, ${result.signalsWritten} signals`
        )
        return result
      }

      // ── bus-factor-scan mode ────────────────────────────────────────────────
      if (payload.mode === 'bus-factor-scan') {
        console.log(`${PREFIX} Scanning all packages for bus factor alerts...`)
        const alerts = await detectBusFactorAlerts(db as any)
        for (const alert of alerts) {
          if (alert.alertLevel === 'declining_to_one') {
            console.warn(`${PREFIX} ⚠ Bus factor declining to 1 for ${alert.packageName}`)
          } else {
            console.log(
              `${PREFIX} [${alert.alertLevel}] ${alert.packageName}: bus factor ${alert.currentBusFactor}`
            )
          }
        }
        console.log(`${PREFIX} Bus factor scan complete: ${alerts.length} alerts`)
        return { alertCount: alerts.length, alerts }
      }

      throw new Error(`Unknown analysis mode: ${(payload as { mode: string }).mode}`)
    },
    { connection: redis }
  )
}
