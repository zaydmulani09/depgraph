import { sql } from 'drizzle-orm'
import { snapshots } from '@depgraph/db'
import type { SnapshotData } from '../snapshots/types'

type AnyDb = {
  select: (...args: unknown[]) => unknown
  execute: (q: unknown) => Promise<unknown>
}

export async function backfillSignalsFromSnapshots(
  db: AnyDb,
  options?: {
    limit?: number
    dryRun?: boolean
  }
): Promise<{ snapshotsProcessed: number; signalsWritten: number }> {
  const limit = options?.limit ?? 30
  const dryRun = options?.dryRun ?? false

  // Query snapshots ordered by snapshotted_at ASC
  const snapshotRows = await (db as any)
    .select({
      id: snapshots.id,
      snapshot_data: snapshots.snapshot_data,
      snapshotted_at: snapshots.snapshotted_at,
    })
    .from(snapshots)
    .orderBy(snapshots.snapshotted_at)
    .limit(limit)

  let snapshotsProcessed = 0
  let signalsWritten = 0

  for (const row of snapshotRows as Array<{
    id: string
    snapshot_data: unknown
    snapshotted_at: Date | null
  }>) {
    const data = row.snapshot_data as SnapshotData
    const ts = row.snapshotted_at ?? new Date()

    for (const entry of data.packages) {
      const sigPairs: Array<{ name: string; value: number }> = [
        { name: 'advisory_count_open', value: entry.advisoryCount },
        { name: 'dependent_count', value: entry.dependentCount },
      ]

      for (const sig of sigPairs) {
        if (dryRun) {
          console.log(
            `[backfill] DRY RUN: ${entry.packageName} ${sig.name}=${sig.value} at ${ts.toISOString()}`
          )
          signalsWritten++
          continue
        }

        // Insert only if no signal exists for this package/name/day
        await db.execute(sql`
          INSERT INTO signals (id, package_id, signal_name, value, measured_at)
          SELECT gen_random_uuid(), ${entry.packageId}::uuid, ${sig.name}, ${sig.value}, ${ts}
          WHERE NOT EXISTS (
            SELECT 1 FROM signals
            WHERE package_id = ${entry.packageId}::uuid
              AND signal_name = ${sig.name}
              AND DATE_TRUNC('day', measured_at) = DATE_TRUNC('day', ${ts}::timestamp)
          )
        `)
        signalsWritten++
      }
    }

    snapshotsProcessed++
    if (snapshotsProcessed % 5 === 0) {
      console.log(
        `[backfill] Processed ${snapshotsProcessed} snapshots, ${signalsWritten} signals written`
      )
    }
  }

  console.log(
    `[backfill] Complete: ${snapshotsProcessed} snapshots processed, ${signalsWritten} signals written`
  )
  return { snapshotsProcessed, signalsWritten }
}
