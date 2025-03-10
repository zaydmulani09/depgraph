import { sql } from 'drizzle-orm'
import { snapshots } from '@depgraph/db'
import type { SnapshotData } from './types'

export async function persistSnapshot(
  db: any,
  data: SnapshotData,
  options?: {
    repositoryId?: string
    label?: string
  }
): Promise<string> {
  const label =
    options?.label ?? `auto-${new Date(data.generatedAt).toISOString().slice(0, 10)}`

  const [row] = await db
    .insert(snapshots)
    .values({
      repository_id: options?.repositoryId ?? null,
      label,
      package_count: data.summary.totalPackages,
      avg_composite_score: data.summary.avgCompositeScore,
      max_composite_score: data.summary.maxCompositeScore,
      violation_count: 0,
      snapshot_data: data,
      snapshotted_at: new Date(data.generatedAt),
    })
    .returning({ id: snapshots.id })

  return row.id
}

export async function getSnapshot(
  db: any,
  snapshotId: string
): Promise<SnapshotData | null> {
  const result = await db.execute(sql.raw(`
    SELECT snapshot_data FROM snapshots WHERE id = '${snapshotId}'
  `))
  const rows = (result.rows ?? result) as Array<{ snapshot_data: unknown }>
  if (rows.length === 0) return null
  return rows[0].snapshot_data as SnapshotData
}

export async function listSnapshots(
  db: any,
  options?: {
    repositoryId?: string
    limit?: number
    before?: Date
  }
): Promise<
  Array<{
    id: string
    label: string | null
    packageCount: number
    avgCompositeScore: number | null
    maxCompositeScore: number | null
    violationCount: number | null
    snapshottedAt: Date
  }>
> {
  const limit = options?.limit ?? 20
  const conditions: string[] = []
  if (options?.repositoryId) {
    conditions.push(`repository_id = '${options.repositoryId}'`)
  }
  if (options?.before) {
    conditions.push(`snapshotted_at < '${options.before.toISOString()}'`)
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const result = await db.execute(sql.raw(`
    SELECT id, label, package_count, avg_composite_score, max_composite_score,
           violation_count, snapshotted_at
    FROM snapshots
    ${where}
    ORDER BY snapshotted_at DESC
    LIMIT ${limit}
  `))

  const rows = (result.rows ?? result) as Array<{
    id: string
    label: string | null
    package_count: number
    avg_composite_score: number | null
    max_composite_score: number | null
    violation_count: number | null
    snapshotted_at: string | Date
  }>

  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    packageCount: r.package_count,
    avgCompositeScore: r.avg_composite_score,
    maxCompositeScore: r.max_composite_score,
    violationCount: r.violation_count,
    snapshottedAt: r.snapshotted_at instanceof Date ? r.snapshotted_at : new Date(r.snapshotted_at),
  }))
}
