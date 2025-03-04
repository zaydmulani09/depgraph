import {
  packages,
  signals,
  advisories,
  versions,
  maintainerVersions,
} from '@depgraph/db'
import { eq, sql } from 'drizzle-orm'
import type { RiskInput, RiskScoreResult, AdvisoryInput, SignalMap } from './types'
import { aggregateRiskScore } from './aggregator'
import { writeRiskScore } from './writer'
import { fetchGraphRiskInputs } from './graph'

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function buildRiskInput(packageId: string, db: any): Promise<RiskInput | null> {
  // Load package metadata
  const [pkg] = await db
    .select({ id: packages.id, name: packages.name, ecosystem: packages.ecosystem })
    .from(packages)
    .where(eq(packages.id, packageId))
    .limit(1)

  if (!pkg) return null

  // Load signals — DISTINCT ON signal_name, most recent measured_at
  const signalRows: Array<{ signal_name: string; value: number }> = await db.execute(
    sql`
      SELECT DISTINCT ON (signal_name) signal_name, value
      FROM signals
      WHERE package_id = ${packageId}::uuid
      ORDER BY signal_name, measured_at DESC
    `
  ).then((r: any) => r.rows ?? r)

  const signalMap: SignalMap = {}
  for (const row of signalRows) {
    signalMap[row.signal_name as keyof SignalMap] = row.value
  }

  // Load advisories
  const advisoryRows: Array<{
    severity: string
    cvss_score: number | null
    withdrawn_at: Date | null
  }> = await db
    .select({
      severity: advisories.severity,
      cvss_score: advisories.cvss_score,
      withdrawn_at: advisories.withdrawn_at,
    })
    .from(advisories)
    .where(eq(advisories.package_id, packageId))

  const advisoryInputs: AdvisoryInput[] = advisoryRows.map((row) => ({
    severity: (row.severity ?? 'unknown') as AdvisoryInput['severity'],
    cvss_score: row.cvss_score ?? null,
    withdrawn_at: row.withdrawn_at ?? null,
  }))

  // Dependent count and transitive depth from consumer_edges
  const { dependentCount, transitiveDepth } = await fetchGraphRiskInputs(packageId, db)

  // Version count
  const [{ vCount }] = await db
    .select({ vCount: sql<number>`count(*)::int` })
    .from(versions)
    .where(eq(versions.package_id, packageId))

  const versionsCount = vCount ?? 0

  // Maintainer count — distinct maintainers across all versions of this package
  const [{ mCount }] = await db
    .select({ mCount: sql<number>`count(distinct mv.maintainer_id)::int` })
    .from(maintainerVersions)
    .innerJoin(versions, eq(maintainerVersions.version_id, versions.id))
    .where(eq(versions.package_id, packageId))

  const maintainerCount = mCount ?? 0

  const ecosystemMap: Record<string, 'npm' | 'pypi' | 'cargo'> = {
    npm: 'npm',
    pypi: 'pypi',
    cargo: 'cargo',
  }

  return {
    packageId,
    packageName: pkg.name,
    ecosystem: ecosystemMap[pkg.ecosystem] ?? 'npm',
    signals: signalMap,
    advisories: advisoryInputs,
    dependentCount,
    transitiveDepth,
    maintainerCount,
    versionsCount,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scorePackage(packageId: string, db: any): Promise<RiskScoreResult> {
  const input = await buildRiskInput(packageId, db)
  if (!input) throw new Error(`scorePackage: package not found — ${packageId}`)

  const result = aggregateRiskScore(input)
  await writeRiskScore(result, db)
  return result
}

export async function scorePackageBatch(
  packageIds: string[],
  db: any,
  concurrency = 5
): Promise<Array<{ packageId: string; result: RiskScoreResult | null; error?: string }>> {
  const results: Array<{ packageId: string; result: RiskScoreResult | null; error?: string }> = []
  let idx = 0

  async function worker(): Promise<void> {
    while (true) {
      const current = idx++
      if (current >= packageIds.length) return

      const packageId = packageIds[current]
      try {
        const result = await scorePackage(packageId, db)
        results[current] = { packageId, result }
      } catch (err) {
        results[current] = {
          packageId,
          result: null,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, packageIds.length) }, worker))
  return results
}
