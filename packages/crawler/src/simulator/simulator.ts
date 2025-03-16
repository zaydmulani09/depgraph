import { sql } from 'drizzle-orm'
import { upgradeEvents } from '@depgraph/db'
import { classifyUpgrade, assessBreakingRisk } from './semver'
import { computeTransitiveDiff } from './transitive-diff'
import type { SimulationResult, ScoreDiff, VersionInfo } from './types'

const WEIGHTS = {
  security: 0.30,
  maintenance: 0.25,
  blast_radius: 0.20,
  concentration: 0.10,
  compatibility: 0.10,
  operational: 0.05,
}

function computeComposite(s: {
  security: number; maintenance: number; blast_radius: number
  concentration: number; compatibility: number; operational: number
}): number {
  return +(
    s.security * WEIGHTS.security +
    s.maintenance * WEIGHTS.maintenance +
    s.blast_radius * WEIGHTS.blast_radius +
    s.concentration * WEIGHTS.concentration +
    s.compatibility * WEIGHTS.compatibility +
    s.operational * WEIGHTS.operational
  ).toFixed(1)
}

export async function simulateUpgrade(
  db: any,
  input: {
    packageName: string
    ecosystem: 'npm' | 'pypi' | 'cargo'
    fromVersion: string
    toVersion: string
  }
): Promise<SimulationResult> {
  const { packageName, ecosystem, fromVersion, toVersion } = input

  // Step 1 — Resolve package
  const pkgResult = await db.execute(sql.raw(`
    SELECT id, name, ecosystem FROM packages
    WHERE name = '${packageName}' AND ecosystem = '${ecosystem}'
    LIMIT 1
  `))
  const pkgRows = (pkgResult.rows ?? pkgResult) as Array<{ id: string; name: string; ecosystem: string }>
  if (pkgRows.length === 0) throw new Error(`Package not found: ${packageName} (${ecosystem})`)
  const pkg = pkgRows[0]
  const packageId = pkg.id

  // Step 2 — Resolve versions
  const verResult = await db.execute(sql.raw(`
    SELECT id, version, published_at, deprecated, has_types, license
    FROM versions WHERE package_id = '${packageId}'
    ORDER BY published_at DESC NULLS LAST
  `))
  const verRows = (verResult.rows ?? verResult) as Array<{
    id: string; version: string; published_at: string | null
    deprecated: boolean; has_types: boolean; license: string | null
  }>

  const fromRow = verRows.find((r) => r.version === fromVersion)
  const toRow = verRows.find((r) => r.version === toVersion)

  const availableVersions: VersionInfo[] = verRows
    .filter((r) => !r.deprecated)
    .slice(0, 20)
    .map((r) => ({
      version: r.version,
      publishedAt: r.published_at ? new Date(r.published_at) : null,
      deprecated: r.deprecated,
      hasTypes: r.has_types,
      license: r.license,
    }))

  // Step 3 — Semver
  const semverCompatibility = classifyUpgrade(fromVersion, toVersion)

  // Step 4 — Current risk score
  const scoreResult = await db.execute(sql.raw(`
    SELECT DISTINCT ON (package_id)
      security_score, maintenance_score, compatibility_score,
      concentration_score, blast_radius_score, operational_score, composite_score
    FROM risk_scores WHERE package_id = '${packageId}'
    ORDER BY package_id, scored_at DESC
  `))
  const scoreRows = (scoreResult.rows ?? scoreResult) as Array<{
    security_score: number; maintenance_score: number; compatibility_score: number
    concentration_score: number; blast_radius_score: number; operational_score: number
    composite_score: number
  }>

  const cur = scoreRows[0] ?? {
    security_score: 0, maintenance_score: 0, compatibility_score: 0,
    concentration_score: 0, blast_radius_score: 0, operational_score: 0, composite_score: 0,
  }
  const fromCompositeScore = cur.composite_score

  // Step 7 — Transitive diff (needed for Step 5)
  const transitiveDiffs = await computeTransitiveDiff(
    db, packageId, fromRow?.id ?? null, toRow?.id ?? null
  )

  // Step 5 — Projected scores
  let security    = cur.security_score
  let maintenance = cur.maintenance_score
  let compatibility = cur.compatibility_score
  let concentration = cur.concentration_score
  let blastRadius = cur.blast_radius_score
  let operational = cur.operational_score

  const addedIds = transitiveDiffs.filter((d) => d.changeType === 'added').map((d) => d.packageId)
  const removedIds = transitiveDiffs.filter((d) => d.changeType === 'removed').map((d) => d.packageId)

  if (addedIds.length > 0) {
    const addedScoreResult = await db.execute(sql.raw(`
      SELECT DISTINCT ON (package_id) package_id, composite_score
      FROM risk_scores WHERE package_id = ANY(ARRAY[${addedIds.map((id) => `'${id}'`).join(',')}]::uuid[])
      ORDER BY package_id, scored_at DESC
    `))
    const addedRows = (addedScoreResult.rows ?? addedScoreResult) as Array<{ composite_score: number }>
    let brAdj = addedRows.reduce((sum, r) => sum + r.composite_score * 0.1, 0)
    brAdj = Math.min(15, brAdj)
    blastRadius = Math.min(100, blastRadius + brAdj)
  }

  if (removedIds.length > 0) {
    const removedScoreResult = await db.execute(sql.raw(`
      SELECT DISTINCT ON (package_id) package_id, composite_score
      FROM risk_scores WHERE package_id = ANY(ARRAY[${removedIds.map((id) => `'${id}'`).join(',')}]::uuid[])
      ORDER BY package_id, scored_at DESC
    `))
    const removedRows = (removedScoreResult.rows ?? removedScoreResult) as Array<{ composite_score: number }>
    const brRed = removedRows.reduce((sum, r) => sum + r.composite_score * 0.05, 0)
    blastRadius = Math.max(0, blastRadius - brRed)
  }

  if (semverCompatibility === 'major') compatibility = Math.min(100, compatibility + 10)
  if (semverCompatibility === 'patch') operational = Math.max(0, operational - 5)

  security     = +security.toFixed(1)
  maintenance  = +maintenance.toFixed(1)
  compatibility = +compatibility.toFixed(1)
  concentration = +concentration.toFixed(1)
  blastRadius  = +blastRadius.toFixed(1)
  operational  = +operational.toFixed(1)

  const toCompositeScore = computeComposite({ security, maintenance, blast_radius: blastRadius, concentration, compatibility, operational })
  const compositeDelta = +(toCompositeScore - fromCompositeScore).toFixed(1)

  // Step 6 — Dimension diffs
  const fromDims = {
    security: cur.security_score, maintenance: cur.maintenance_score,
    compatibility: cur.compatibility_score, concentration: cur.concentration_score,
    blast_radius: cur.blast_radius_score, operational: cur.operational_score,
  }
  const toDims = { security, maintenance, compatibility, concentration, blast_radius: blastRadius, operational }

  const dimensionDiffs: ScoreDiff[] = (Object.keys(fromDims) as Array<keyof typeof fromDims>)
    .map((dim) => ({
      dimension: dim,
      fromScore: fromDims[dim],
      toScore: toDims[dim],
      delta: +(toDims[dim] - fromDims[dim]).toFixed(1),
    }))
    .filter((d) => Math.abs(d.delta) > 0.5)

  // Step 8 — Affected downstream
  const ceResult = await db.execute(sql.raw(`
    SELECT COUNT(DISTINCT consumer_version_id)::int AS cnt
    FROM consumer_edges WHERE package_id = '${packageId}'
  `))
  const ceRows = (ceResult.rows ?? ceResult) as Array<{ cnt: number }>
  const affectedDownstreamCount = ceRows[0]?.cnt ?? 0

  // Step 9 — Breaking risk
  const breakingRisk = assessBreakingRisk(semverCompatibility, fromCompositeScore, toCompositeScore)

  // Step 10 — Warnings
  const warnings: string[] = []
  if (toRow?.deprecated) warnings.push(`Target version ${toVersion} is marked as deprecated`)
  if (semverCompatibility === 'major') warnings.push('Major version upgrade — review changelog for breaking changes')
  if (transitiveDiffs.length > 10) warnings.push(`This upgrade changes ${transitiveDiffs.length} transitive dependencies`)
  if (breakingRisk === 'high') warnings.push('High breaking risk detected — test thoroughly before upgrading')
  if (fromCompositeScore === 0) warnings.push('No existing risk score found — run a full crawl first for accurate simulation')

  // Step 11 — Persist upgrade event
  await db.insert(upgradeEvents).values({
    package_id: packageId,
    from_version: fromVersion,
    to_version: toVersion,
    is_breaking: semverCompatibility === 'major',
    score_delta: compositeDelta,
    simulated: true,
  })

  return {
    packageId,
    packageName: pkg.name,
    ecosystem: pkg.ecosystem,
    fromVersion,
    toVersion,
    semverCompatibility,
    breakingRisk,
    fromCompositeScore,
    toCompositeScore,
    compositeDelta,
    dimensionDiffs,
    transitiveDiffs,
    affectedDownstreamCount,
    availableVersions,
    simulatedAt: new Date().toISOString(),
    warnings,
  }
}
