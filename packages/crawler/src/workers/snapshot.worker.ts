import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import { sql, eq } from 'drizzle-orm'
import { snapshots } from '@depgraph/db'
import { buildSnapshot } from '../snapshots/builder'
import { persistSnapshot, getSnapshot } from '../snapshots/persister'
import { diffSnapshots } from '../snapshots/differ'
import { seedBuiltinRules, loadEnabledRules } from '../policy/seeder'
import { evaluateRules } from '../policy/engine'
import { writePolicyViolations } from '../policy/writer'
import { findCrossEcosystemMatches } from '../normalization/identity-resolver'
import type { AlertConfig } from '../alerting/types'
import { AlertDeduplicator } from '../alerting/deduplicator'
import { AlertStore } from '../alerting/store'
import { AlertDispatcher } from '../alerting/dispatcher'
import { detectDrift } from '../alerting/drift-detector'

const PREFIX = '[snapshot]'
const POLICY_PREFIX = '[policy]'

async function runPolicyEvaluation(db: any, snapshotId: string, packages: any[]): Promise<void> {
  let rules = await loadEnabledRules(db)
  if (rules.length === 0) {
    await seedBuiltinRules(db)
    rules = await loadEnabledRules(db)
  }
  const violations = evaluateRules(rules, packages)
  await writePolicyViolations(db, violations, snapshotId)
  await db.update(snapshots).set({ violation_count: violations.length }).where(eq(snapshots.id, snapshotId))
  const blockCount = violations.filter((v) => v.action === 'block').length
  const warnCount = violations.filter((v) => v.action === 'warn').length
  const approvalCount = violations.filter((v) => v.action === 'require_approval').length
  console.log(`${POLICY_PREFIX} ${violations.length} violations found (${blockCount} block, ${warnCount} warn, ${approvalCount} require_approval)`)
}

type SnapshotJobPayload =
  | { mode: 'full' }
  | { mode: 'ecosystem'; ecosystem: 'npm' | 'pypi' | 'cargo' }
  | { mode: 'repository'; repositoryId: string }
  | { mode: 'diff'; previousSnapshotId: string; currentSnapshotId: string }

export function createSnapshotWorker(deps: { redis: Redis; db: any; alertConfig?: AlertConfig }): Worker {
  const { redis, db, alertConfig } = deps

  return new Worker(
    'snapshot',
    async (job) => {
      const payload = job.data as SnapshotJobPayload
      const date = new Date().toISOString().slice(0, 10)

      if (payload.mode === 'full') {
        console.log(`${PREFIX} Building full snapshot`)
        const data = await buildSnapshot(db)
        const snapshotId = await persistSnapshot(db, data, { label: `auto-full-${date}` })
        console.log(`${PREFIX} Persisted full snapshot ${snapshotId} (${data.summary.totalPackages} packages)`)

        await runPolicyEvaluation(db, snapshotId, data.packages)

        // Run cross-ecosystem identity resolution
        const matches = await findCrossEcosystemMatches(db, { minConfidence: 0.7 })
        if (matches.length > 0) {
          console.log(`${PREFIX} Found ${matches.length} cross-ecosystem package identity matches`)
        }

        // Run drift detection and dispatch alerts
        if (alertConfig) {
          try {
            const deduplicator = new AlertDeduplicator(redis)
            const store = new AlertStore(redis)
            const dispatcher = new AlertDispatcher(alertConfig, deduplicator)
            const driftResult = await detectDrift(db, snapshotId)
            if (driftResult.alerts.length > 0) {
              const dispatchResult = await dispatcher.dispatch(driftResult.alerts)
              for (const alert of driftResult.alerts) {
                await store.save(alert)
              }
              console.log(
                `${PREFIX} Drift detection: ${driftResult.alerts.length} alerts, ` +
                  `${dispatchResult.delivered} delivered, ${dispatchResult.deduplicated} deduplicated`
              )
            }
          } catch (err) {
            console.error(`${PREFIX} Drift detection error:`, err)
          }
        }

        // Fetch two most recent to auto-diff
        const recentResult = await db.execute(sql.raw(`
          SELECT id, snapshot_data FROM snapshots
          ORDER BY snapshotted_at DESC LIMIT 2
        `))
        const recentRows = (recentResult.rows ?? recentResult) as Array<{
          id: string
          snapshot_data: unknown
        }>

        if (recentRows.length >= 2) {
          const currentSnap = recentRows[0].snapshot_data as ReturnType<typeof Object>
          const prevSnap = recentRows[1].snapshot_data as ReturnType<typeof Object>
          const diff = diffSnapshots(
            prevSnap as any,
            currentSnap as any,
            recentRows[1].id,
            recentRows[0].id
          )
          console.log(
            `${PREFIX} Diff: +${diff.added.length} added, -${diff.removed.length} removed, ` +
              `${diff.degraded.length} degraded, ${diff.improved.length} improved, ` +
              `${diff.newVulnerabilityChains.length} new vuln chains`
          )
          return {
            snapshotId,
            packageCount: data.summary.totalPackages,
            degradedCount: diff.degraded.length,
            newVulnChains: diff.newVulnerabilityChains.length,
          }
        }

        return { snapshotId, packageCount: data.summary.totalPackages, degradedCount: 0, newVulnChains: 0 }
      }

      if (payload.mode === 'ecosystem') {
        const { ecosystem } = payload
        console.log(`${PREFIX} Building ecosystem snapshot for ${ecosystem}`)
        const data = await buildSnapshot(db, { ecosystem })
        const snapshotId = await persistSnapshot(db, data, { label: `auto-${ecosystem}-${date}` })
        console.log(`${PREFIX} Persisted ecosystem snapshot ${snapshotId}`)
        await runPolicyEvaluation(db, snapshotId, data.packages)
        return { snapshotId, packageCount: data.summary.totalPackages }
      }

      if (payload.mode === 'repository') {
        const { repositoryId } = payload
        console.log(`${PREFIX} Building repo snapshot for ${repositoryId}`)
        const data = await buildSnapshot(db, { repositoryId })
        const snapshotId = await persistSnapshot(db, data, {
          repositoryId,
          label: `auto-repo-${repositoryId}-${date}`,
        })
        console.log(`${PREFIX} Persisted repo snapshot ${snapshotId}`)
        return { snapshotId, packageCount: data.summary.totalPackages }
      }

      if (payload.mode === 'diff') {
        const { previousSnapshotId, currentSnapshotId } = payload
        const [prev, curr] = await Promise.all([
          getSnapshot(db, previousSnapshotId),
          getSnapshot(db, currentSnapshotId),
        ])
        if (!prev) throw new Error(`snapshot not found: ${previousSnapshotId}`)
        if (!curr) throw new Error(`snapshot not found: ${currentSnapshotId}`)

        const diff = diffSnapshots(prev, curr, previousSnapshotId, currentSnapshotId)
        console.log(
          `${PREFIX} Diff complete: +${diff.added.length} added, -${diff.removed.length} removed, ` +
            `${diff.degraded.length} degraded, ${diff.improved.length} improved, ` +
            `${diff.unchanged.length} unchanged, ${diff.newVulnerabilityChains.length} new vuln chains`
        )
        return diff
      }

      throw new Error(`unknown snapshot mode: ${(payload as any).mode}`)
    },
    { connection: redis }
  )
}
