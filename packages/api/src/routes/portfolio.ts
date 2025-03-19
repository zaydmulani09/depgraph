import { Hono } from 'hono'
import { db } from '@depgraph/db'
import { sql } from 'drizzle-orm'
import { ok } from '../lib/response'
import { detectCrossEcosystemChokepoints } from '@depgraph/crawler/src/normalization/chokepoint-detector'

const router = new Hono()

// GET /portfolio/summary
router.get('/summary', async (c) => {
  const [
    pkgStats,
    versionStats,
    advisoryStats,
    scoreStats,
    scoreDistrib,
    violationStats,
    snapshotStats,
    ecosystemStats,
  ] = await Promise.all([
    db.execute(sql.raw(`SELECT COUNT(*) AS total FROM packages`)),
    db.execute(sql.raw(`SELECT COUNT(*) AS total FROM versions`)),
    db.execute(sql.raw(`SELECT COUNT(*) AS total FROM advisories WHERE withdrawn_at IS NULL`)),
    db.execute(sql.raw(`
      SELECT AVG(rs.composite_score) AS avg_score, MAX(rs.composite_score) AS max_score
      FROM (
        SELECT DISTINCT ON (package_id) composite_score
        FROM risk_scores ORDER BY package_id, scored_at DESC
      ) rs
    `)),
    db.execute(sql.raw(`
      WITH latest_scores AS (
        SELECT DISTINCT ON (package_id) composite_score, package_id
        FROM risk_scores ORDER BY package_id, scored_at DESC
      )
      SELECT
        COUNT(*) FILTER (WHERE ls.composite_score > 75) AS critical,
        COUNT(*) FILTER (WHERE ls.composite_score >= 50 AND ls.composite_score <= 75) AS high,
        COUNT(*) FILTER (WHERE ls.composite_score >= 25 AND ls.composite_score < 50) AS medium,
        COUNT(*) FILTER (WHERE ls.composite_score < 25) AS low,
        (SELECT COUNT(*) FROM packages p WHERE NOT EXISTS (
          SELECT 1 FROM risk_scores rs2 WHERE rs2.package_id = p.id
        )) AS unscored
      FROM latest_scores ls
    `)),
    db.execute(sql.raw(`
      SELECT
        COUNT(*) AS active_violations,
        COUNT(*) FILTER (WHERE action = 'block') AS block_violations
      FROM policy_violations WHERE resolved_at IS NULL
    `)),
    db.execute(sql.raw(
      `SELECT id, snapshotted_at FROM snapshots ORDER BY snapshotted_at DESC LIMIT 1`
    )),
    db.execute(sql.raw(`SELECT ecosystem, COUNT(*) AS cnt FROM packages GROUP BY ecosystem`)),
  ])

  const pkgRow = ((pkgStats.rows ?? pkgStats) as Array<Record<string, unknown>>)[0]
  const versionRow = ((versionStats.rows ?? versionStats) as Array<Record<string, unknown>>)[0]
  const advisoryRow = ((advisoryStats.rows ?? advisoryStats) as Array<Record<string, unknown>>)[0]
  const scoreRow = ((scoreStats.rows ?? scoreStats) as Array<Record<string, unknown>>)[0]
  const distribRow = ((scoreDistrib.rows ?? scoreDistrib) as Array<Record<string, unknown>>)[0]
  const violRow = ((violationStats.rows ?? violationStats) as Array<Record<string, unknown>>)[0]
  const snapshotRow = ((snapshotStats.rows ?? snapshotStats) as Array<Record<string, unknown>>)[0]
  const ecoRows = (ecosystemStats.rows ?? ecosystemStats) as Array<Record<string, unknown>>

  const packagesByEcosystem: Record<string, number> = {}
  for (const row of ecoRows) {
    packagesByEcosystem[String(row['ecosystem'])] = Number(row['cnt'])
  }

  return ok(c, {
    totalPackages: Number(pkgRow?.['total'] ?? 0),
    totalVersions: Number(versionRow?.['total'] ?? 0),
    totalAdvisories: Number(advisoryRow?.['total'] ?? 0),
    avgCompositeScore: scoreRow?.['avg_score'] != null ? Number(scoreRow['avg_score']) : 0,
    maxCompositeScore: scoreRow?.['max_score'] != null ? Number(scoreRow['max_score']) : 0,
    packagesByEcosystem,
    scoreDistribution: {
      critical: Number(distribRow?.['critical'] ?? 0),
      high: Number(distribRow?.['high'] ?? 0),
      medium: Number(distribRow?.['medium'] ?? 0),
      low: Number(distribRow?.['low'] ?? 0),
      unscored: Number(distribRow?.['unscored'] ?? 0),
    },
    activeViolations: Number(violRow?.['active_violations'] ?? 0),
    blockViolations: Number(violRow?.['block_violations'] ?? 0),
    lastSnapshotAt: snapshotRow?.['snapshotted_at'] != null ? String(snapshotRow['snapshotted_at']) : null,
    lastSnapshotId: snapshotRow?.['id'] != null ? String(snapshotRow['id']) : null,
  })
})

// GET /portfolio/top-risky
router.get('/top-risky', async (c) => {
  const ecosystem = c.req.query('ecosystem')
  const limit = Math.min(Number(c.req.query('limit') ?? 10), 50)
  const ecosystemFilter = ecosystem ? `AND p.ecosystem = '${ecosystem}'` : ''

  const result = await db.execute(sql.raw(`
    SELECT p.id, p.name, p.ecosystem, p.weekly_downloads, p.last_published_at,
           rs.composite_score, rs.security_score, rs.maintenance_score, rs.blast_radius_score
    FROM packages p
    INNER JOIN LATERAL (
      SELECT composite_score, security_score, maintenance_score, blast_radius_score
      FROM risk_scores WHERE package_id = p.id
      ORDER BY scored_at DESC LIMIT 1
    ) rs ON true
    WHERE 1=1 ${ecosystemFilter}
    ORDER BY rs.composite_score DESC
    LIMIT ${limit}
  `))

  return ok(c, (result.rows ?? result) as unknown[])
})

// GET /portfolio/chokepoints
router.get('/chokepoints', async (c) => {
  const ecosystem = c.req.query('ecosystem') as 'npm' | 'pypi' | 'cargo' | undefined
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)

  const chokepoints = await detectCrossEcosystemChokepoints(db, { minConsumers: 5, limit })
  const filtered = ecosystem ? chokepoints.filter((cp) => cp.ecosystem === ecosystem) : chokepoints

  return ok(c, filtered)
})

// GET /portfolio/ecosystem-breakdown
router.get('/ecosystem-breakdown', async (c) => {
  const ecosystems = ['npm', 'pypi', 'cargo'] as const

  const results = await Promise.all(
    ecosystems.map(async (eco) => {
      const [statsResult, topPkgResult] = await Promise.all([
        db.execute(sql.raw(`
          WITH latest_scores AS (
            SELECT DISTINCT ON (rs.package_id) rs.composite_score, rs.package_id
            FROM risk_scores rs
            JOIN packages p ON p.id = rs.package_id
            WHERE p.ecosystem = '${eco}'
            ORDER BY rs.package_id, rs.scored_at DESC
          )
          SELECT
            (SELECT COUNT(*) FROM packages WHERE ecosystem = '${eco}') AS package_count,
            AVG(ls.composite_score) AS avg_score,
            MAX(ls.composite_score) AS max_score,
            COUNT(*) FILTER (WHERE ls.composite_score > 75) AS critical_count,
            (
              SELECT COUNT(*) FROM advisories a
              JOIN packages pp ON pp.id = a.package_id
              WHERE pp.ecosystem = '${eco}' AND a.withdrawn_at IS NULL
            ) AS advisory_count
          FROM latest_scores ls
        `)),
        db.execute(sql.raw(`
          SELECT p.name, rs.composite_score
          FROM packages p
          INNER JOIN LATERAL (
            SELECT composite_score FROM risk_scores WHERE package_id = p.id ORDER BY scored_at DESC LIMIT 1
          ) rs ON true
          WHERE p.ecosystem = '${eco}'
          ORDER BY rs.composite_score DESC
          LIMIT 1
        `)),
      ])

      const sr = ((statsResult.rows ?? statsResult) as Array<Record<string, unknown>>)[0]
      const tr = ((topPkgResult.rows ?? topPkgResult) as Array<Record<string, unknown>>)[0]

      return {
        ecosystem: eco,
        packageCount: Number(sr?.['package_count'] ?? 0),
        avgCompositeScore: sr?.['avg_score'] != null ? Number(sr['avg_score']) : 0,
        maxCompositeScore: sr?.['max_score'] != null ? Number(sr['max_score']) : 0,
        criticalCount: Number(sr?.['critical_count'] ?? 0),
        advisoryCount: Number(sr?.['advisory_count'] ?? 0),
        topRiskyPackage: tr
          ? { name: String(tr['name']), score: Number(tr['composite_score']) }
          : null,
      }
    })
  )

  return ok(c, results)
})

// GET /portfolio/trend
router.get('/trend', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 10), 50)

  const result = await db.execute(sql.raw(`
    SELECT id, label, package_count, avg_composite_score, max_composite_score, violation_count, snapshotted_at
    FROM snapshots
    ORDER BY snapshotted_at DESC
    LIMIT ${limit}
  `))

  const rows = ((result.rows ?? result) as Array<Record<string, unknown>>).reverse()
  const trend = rows.map((r) => ({
    snapshotId: String(r['id']),
    label: r['label'] != null ? String(r['label']) : null,
    snapshottedAt: String(r['snapshotted_at']),
    avgCompositeScore: r['avg_composite_score'] != null ? Number(r['avg_composite_score']) : null,
    maxCompositeScore: r['max_composite_score'] != null ? Number(r['max_composite_score']) : null,
    packageCount: Number(r['package_count'] ?? 0),
    violationCount: r['violation_count'] != null ? Number(r['violation_count']) : null,
  }))

  return ok(c, trend)
})

export { router as portfolioRouter }
