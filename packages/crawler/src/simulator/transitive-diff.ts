import { sql } from 'drizzle-orm'
import type { TransitiveDiff } from './types'

interface DepRow {
  to_package_id: string
  name: string
  ecosystem: string
  version: string
}

async function getDepsForVersion(
  db: any,
  versionId: string | null
): Promise<Map<string, { name: string; ecosystem: string; version: string }>> {
  if (!versionId) return new Map()

  const result = await db.execute(sql.raw(`
    SELECT de.to_package_id, p.name, p.ecosystem, de.version_range AS version
    FROM dependency_edges de
    JOIN packages p ON p.id = de.to_package_id
    WHERE de.from_version_id = '${versionId}'
  `))

  const rows: DepRow[] = (result.rows ?? result) as DepRow[]
  const map = new Map<string, { name: string; ecosystem: string; version: string }>()
  for (const row of rows) {
    map.set(row.to_package_id, {
      name: row.name,
      ecosystem: row.ecosystem,
      version: row.version,
    })
  }
  return map
}

export async function computeTransitiveDiff(
  db: any,
  packageId: string,
  fromVersionId: string | null,
  toVersionId: string | null
): Promise<TransitiveDiff[]> {
  const [fromDeps, toDeps] = await Promise.all([
    getDepsForVersion(db, fromVersionId),
    getDepsForVersion(db, toVersionId),
  ])

  const diffs: TransitiveDiff[] = []

  // Added: in to but not in from
  for (const [pkgId, info] of toDeps) {
    if (!fromDeps.has(pkgId)) {
      diffs.push({
        packageId: pkgId,
        packageName: info.name,
        ecosystem: info.ecosystem,
        changeType: 'added',
        fromVersion: null,
        toVersion: info.version,
        depth: 1,
      })
    }
  }

  // Removed: in from but not in to
  for (const [pkgId, info] of fromDeps) {
    if (!toDeps.has(pkgId)) {
      diffs.push({
        packageId: pkgId,
        packageName: info.name,
        ecosystem: info.ecosystem,
        changeType: 'removed',
        fromVersion: info.version,
        toVersion: null,
        depth: 1,
      })
    }
  }

  // Version changed: in both but different version
  for (const [pkgId, toInfo] of toDeps) {
    const fromInfo = fromDeps.get(pkgId)
    if (fromInfo && fromInfo.version !== toInfo.version) {
      diffs.push({
        packageId: pkgId,
        packageName: toInfo.name,
        ecosystem: toInfo.ecosystem,
        changeType: 'version_changed',
        fromVersion: fromInfo.version,
        toVersion: toInfo.version,
        depth: 1,
      })
    }
  }

  return diffs.sort(
    (a, b) => a.changeType.localeCompare(b.changeType) || a.packageName.localeCompare(b.packageName)
  )
}
