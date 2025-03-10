import { sql } from 'drizzle-orm'
import type { SnapshotData, SnapshotPackageEntry } from './types'

interface ScoreRow {
  package_id: string
  score_id: string
  package_name: string
  ecosystem: string
  composite_score: number
  security_score: number
  maintenance_score: number
  compatibility_score: number
  concentration_score: number
  blast_radius_score: number
  operational_score: number
}

interface ExplanationRow {
  package_id: string
  factor_name: string
  dimension: string
  contribution_pct: number
  description: string
}

interface CountRow {
  package_id: string
  count: number
}

export async function buildSnapshot(
  db: any,
  options?: {
    ecosystem?: 'npm' | 'pypi' | 'cargo'
    repositoryId?: string
    label?: string
  }
): Promise<SnapshotData> {
  const { ecosystem, repositoryId } = options ?? {}

  const repoJoin = repositoryId
    ? `JOIN package_repositories pr ON pr.package_id = p.id AND pr.repository_id = '${repositoryId}'`
    : ''
  const ecoWhere = ecosystem ? `WHERE p.ecosystem = '${ecosystem}'` : ''

  const mainResult = await db.execute(sql.raw(`
    SELECT DISTINCT ON (rs.package_id)
      rs.package_id,
      rs.id AS score_id,
      p.name AS package_name,
      p.ecosystem,
      rs.composite_score,
      rs.security_score,
      rs.maintenance_score,
      rs.compatibility_score,
      rs.concentration_score,
      rs.blast_radius_score,
      rs.operational_score
    FROM risk_scores rs
    JOIN packages p ON p.id = rs.package_id
    ${repoJoin}
    ${ecoWhere}
    ORDER BY rs.package_id, rs.scored_at DESC
  `))
  const scoreRows: ScoreRow[] = (mainResult.rows ?? mainResult) as ScoreRow[]

  if (scoreRows.length === 0) {
    return makeEmptySnapshot(ecosystem, repositoryId)
  }

  const packageIds = scoreRows.map((r) => r.package_id)
  const scoreIds = scoreRows.map((r) => r.score_id)

  const idList = (ids: string[]) => ids.map((id) => `'${id}'`).join(',')

  // Explanations for all latest score rows
  const explResult = await db.execute(sql.raw(`
    SELECT rs.package_id, re.factor_name, re.dimension, re.contribution_pct, re.description
    FROM risk_explanations re
    JOIN risk_scores rs ON rs.id = re.risk_score_id
    WHERE re.risk_score_id = ANY(ARRAY[${idList(scoreIds)}]::uuid[])
    ORDER BY re.contribution_pct DESC
  `))
  const explRows: ExplanationRow[] = (explResult.rows ?? explResult) as ExplanationRow[]

  // Group explanations by package_id, top 5 each
  const explByPkg = new Map<string, ExplanationRow[]>()
  for (const row of explRows) {
    if (!explByPkg.has(row.package_id)) explByPkg.set(row.package_id, [])
    const arr = explByPkg.get(row.package_id)!
    if (arr.length < 5) arr.push(row)
  }

  // Advisory counts (non-withdrawn)
  const advResult = await db.execute(sql.raw(`
    SELECT package_id, COUNT(*)::int AS count
    FROM advisories
    WHERE withdrawn_at IS NULL
      AND package_id = ANY(ARRAY[${idList(packageIds)}]::uuid[])
    GROUP BY package_id
  `))
  const advRows: CountRow[] = (advResult.rows ?? advResult) as CountRow[]
  const advByPkg = new Map(advRows.map((r) => [r.package_id, r.count]))

  // Consumer edges counts (dependentCount)
  const ceResult = await db.execute(sql.raw(`
    SELECT package_id, COUNT(*)::int AS count
    FROM consumer_edges
    WHERE package_id = ANY(ARRAY[${idList(packageIds)}]::uuid[])
    GROUP BY package_id
  `))
  const ceRows: CountRow[] = (ceResult.rows ?? ceResult) as CountRow[]
  const ceByPkg = new Map(ceRows.map((r) => [r.package_id, r.count]))

  // Maintainer counts
  const mResult = await db.execute(sql.raw(`
    SELECT v.package_id, COUNT(DISTINCT mv.maintainer_id)::int AS count
    FROM maintainer_versions mv
    JOIN versions v ON v.id = mv.version_id
    WHERE v.package_id = ANY(ARRAY[${idList(packageIds)}]::uuid[])
    GROUP BY v.package_id
  `))
  const mRows: CountRow[] = (mResult.rows ?? mResult) as CountRow[]
  const mByPkg = new Map(mRows.map((r) => [r.package_id, r.count]))

  // Build entries
  const entries: SnapshotPackageEntry[] = scoreRows.map((row) => ({
    packageId: row.package_id,
    packageName: row.package_name,
    ecosystem: row.ecosystem,
    compositeScore: row.composite_score,
    securityScore: row.security_score,
    maintenanceScore: row.maintenance_score,
    compatibilityScore: row.compatibility_score,
    concentrationScore: row.concentration_score,
    blastRadiusScore: row.blast_radius_score,
    operationalScore: row.operational_score,
    advisoryCount: advByPkg.get(row.package_id) ?? 0,
    maintainerCount: mByPkg.get(row.package_id) ?? 0,
    dependentCount: ceByPkg.get(row.package_id) ?? 0,
    topExplanations: (explByPkg.get(row.package_id) ?? []).map((e) => ({
      factor_name: e.factor_name,
      dimension: e.dimension,
      contribution_pct: e.contribution_pct,
      description: e.description,
    })),
  }))

  return buildSnapshotData(entries, ecosystem, repositoryId)
}

function buildSnapshotData(
  entries: SnapshotPackageEntry[],
  ecosystem?: string,
  repositoryId?: string
): SnapshotData {
  const total = entries.length
  const avg = total > 0 ? entries.reduce((s, e) => s + e.compositeScore, 0) / total : 0
  const max = total > 0 ? Math.max(...entries.map((e) => e.compositeScore)) : 0
  const criticalCount = entries.filter((e) => e.compositeScore > 75).length
  const highCount = entries.filter((e) => e.compositeScore > 50).length

  const packagesByEcosystem: Record<string, number> = {}
  for (const e of entries) {
    packagesByEcosystem[e.ecosystem] = (packagesByEcosystem[e.ecosystem] ?? 0) + 1
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    ...(ecosystem ? { ecosystem } : {}),
    ...(repositoryId ? { repositoryId } : {}),
    packages: entries,
    summary: {
      totalPackages: total,
      avgCompositeScore: avg,
      maxCompositeScore: max,
      criticalCount,
      highCount,
      packagesByEcosystem,
    },
  }
}

function makeEmptySnapshot(ecosystem?: string, repositoryId?: string): SnapshotData {
  return buildSnapshotData([], ecosystem, repositoryId)
}
