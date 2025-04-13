import { sql, eq } from 'drizzle-orm'
import { packages } from '@depgraph/db'
import type { db as DbType } from '@depgraph/db'
import type { Ecosystem } from './adapter'

export interface CrossEcosystemChokepoint {
  packageId: string
  packageName: string
  ecosystem: Ecosystem
  directConsumers: number
  transitiveConsumers: number
  ecosystemsAffected: Ecosystem[]
  chokepointScore: number
  reason: string
}

export async function detectCrossEcosystemChokepoints(
  db: typeof DbType,
  options?: { minConsumers?: number; limit?: number }
): Promise<CrossEcosystemChokepoint[]> {
  const minConsumers = options?.minConsumers ?? 10
  const limit = options?.limit ?? 50

  let statsRows: Array<Record<string, unknown>> = []
  try {
    const result = await db.execute(sql`
      SELECT ce.package_id,
             COUNT(ce.consumer_version_id) as direct_consumers,
             MAX(ce.depth) as max_depth
      FROM consumer_edges ce
      GROUP BY ce.package_id
      HAVING COUNT(ce.consumer_version_id) >= ${minConsumers}
      ORDER BY direct_consumers DESC
      LIMIT ${sql.raw(String(limit * 2))}
    `)
    statsRows = (result.rows ?? result) as Array<Record<string, unknown>>
  } catch {
    return []
  }

  const results: CrossEcosystemChokepoint[] = []

  for (const row of statsRows) {
    const packageId = String(row['package_id'])
    const directConsumers = Number(row['direct_consumers'])
    const maxDepth = Number(row['max_depth'])

    const [pkg] = await db
      .select({ id: packages.id, name: packages.name, ecosystem: packages.ecosystem })
      .from(packages)
      .where(eq(packages.id, packageId))
      .limit(1)

    if (!pkg) continue

    let ecosystemsAffected: Ecosystem[] = []
    try {
      const ecoResult = await db.execute(sql`
        SELECT DISTINCT p.ecosystem
        FROM dependency_edges de
        JOIN versions v ON de.from_version_id = v.id
        JOIN packages p ON v.package_id = p.id
        WHERE de.to_package_id = ${packageId}
          AND p.ecosystem != ${pkg.ecosystem}
      `)
      ecosystemsAffected = ((ecoResult.rows ?? ecoResult) as Array<Record<string, string>>)
        .map((r) => r['ecosystem'] as Ecosystem)
    } catch { /* empty */ }

    const chokepointScore = Math.min(100, directConsumers / 10 + maxDepth * 5)
    const totalEcosystems = ecosystemsAffected.length + 1
    const reason = `Used by ${directConsumers} packages across ${totalEcosystems} ecosystem${totalEcosystems !== 1 ? 's' : ''}, max depth ${maxDepth}`

    results.push({
      packageId: pkg.id,
      packageName: pkg.name,
      ecosystem: pkg.ecosystem as Ecosystem,
      directConsumers,
      transitiveConsumers: directConsumers,
      ecosystemsAffected,
      chokepointScore,
      reason,
    })
  }

  return results
    .sort((a, b) => b.chokepointScore - a.chokepointScore)
    .slice(0, limit)
}
