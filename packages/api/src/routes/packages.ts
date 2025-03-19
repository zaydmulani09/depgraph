import { Hono } from 'hono'
import { db } from '@depgraph/db'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { ok, err, paginated } from '../lib/response'
import { parseQuery } from '../lib/validate'

const router = new Hono()

const listSchema = z.object({
  ecosystem: z.enum(['npm', 'pypi', 'cargo']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['composite_score_desc', 'name_asc', 'updated_asc']).default('composite_score_desc'),
})

// GET /packages
router.get('/', async (c) => {
  const parsed = parseQuery(c, listSchema)
  if (!parsed.success) return parsed.response

  const { ecosystem, page, limit, sort } = parsed.data as z.infer<typeof listSchema>
  const offset = (page - 1) * limit

  const ecosystemFilter = ecosystem ? `AND p.ecosystem = '${ecosystem}'` : ''
  const orderBy =
    sort === 'name_asc' ? 'p.name ASC' :
    sort === 'updated_asc' ? 'p.last_published_at ASC NULLS LAST' :
    'rs.composite_score DESC NULLS LAST'

  const dataResult = await db.execute(sql.raw(`
    SELECT p.id, p.name, p.ecosystem, p.latest_version, p.last_published_at, p.weekly_downloads,
           rs.composite_score, rs.security_score, rs.maintenance_score
    FROM packages p
    LEFT JOIN LATERAL (
      SELECT composite_score, security_score, maintenance_score
      FROM risk_scores WHERE package_id = p.id
      ORDER BY scored_at DESC LIMIT 1
    ) rs ON true
    WHERE 1=1 ${ecosystemFilter}
    ORDER BY ${orderBy}
    LIMIT ${limit} OFFSET ${offset}
  `))

  const countResult = await db.execute(sql.raw(`
    SELECT COUNT(*) AS total FROM packages p WHERE 1=1 ${ecosystemFilter}
  `))

  const rows = (dataResult.rows ?? dataResult) as unknown[]
  const countRows = (countResult.rows ?? countResult) as Array<{ total: string | number }>
  const total = Number(countRows[0]?.total ?? 0)

  return paginated(c, rows, total, page, limit)
})

// GET /packages/:ecosystem/:name
router.get('/:ecosystem/:name', async (c) => {
  const { ecosystem, name } = c.req.param()

  const pkgResult = await db.execute(sql.raw(`
    SELECT p.*,
           rs.id AS score_id, rs.security_score, rs.maintenance_score, rs.compatibility_score,
           rs.concentration_score, rs.blast_radius_score, rs.operational_score, rs.composite_score,
           rs.scored_at
    FROM packages p
    LEFT JOIN LATERAL (
      SELECT * FROM risk_scores WHERE package_id = p.id ORDER BY scored_at DESC LIMIT 1
    ) rs ON true
    WHERE p.ecosystem = '${ecosystem}' AND p.name = '${name}'
    LIMIT 1
  `))

  const pkgRows = (pkgResult.rows ?? pkgResult) as unknown[]
  if (pkgRows.length === 0) return err(c, 'Package not found', 404, 'NOT_FOUND')
  const pkg = pkgRows[0] as Record<string, unknown>

  // Top 10 explanations
  let explanations: unknown[] = []
  if (pkg.score_id) {
    const expResult = await db.execute(sql.raw(`
      SELECT factor_name, dimension, contribution_pct, raw_value, description
      FROM risk_explanations
      WHERE risk_score_id = '${pkg.score_id}'
      ORDER BY contribution_pct DESC
      LIMIT 10
    `))
    explanations = (expResult.rows ?? expResult) as unknown[]
  }

  // Active advisories (max 5)
  const advResult = await db.execute(sql.raw(`
    SELECT id, osv_id, title, severity, cvss_score, published_at
    FROM advisories
    WHERE package_id = '${pkg.id}' AND withdrawn_at IS NULL
    ORDER BY cvss_score DESC NULLS LAST
    LIMIT 5
  `))
  const advisories = (advResult.rows ?? advResult) as unknown[]

  const advCountResult = await db.execute(sql.raw(`
    SELECT COUNT(*) AS count FROM advisories WHERE package_id = '${pkg.id}' AND withdrawn_at IS NULL
  `))
  const advCountRows = (advCountResult.rows ?? advCountResult) as Array<{ count: string | number }>
  const advisoryCount = Number(advCountRows[0]?.count ?? 0)

  // Recent signals (last 5 per signal name)
  const sigResult = await db.execute(sql.raw(`
    SELECT DISTINCT ON (signal_name) signal_name, value, measured_at
    FROM signals
    WHERE package_id = '${pkg.id}'
    ORDER BY signal_name, measured_at DESC
  `))
  const signals = (sigResult.rows ?? sigResult) as unknown[]

  // Consumer edges count
  const ceResult = await db.execute(sql.raw(`
    SELECT COUNT(*) AS count, MIN(depth) AS min_depth, MAX(depth) AS max_depth
    FROM consumer_edges WHERE package_id = '${pkg.id}'
  `))
  const ceRows = (ceResult.rows ?? ceResult) as Array<{ count: string | number; min_depth: number; max_depth: number }>

  return ok(c, {
    ...pkg,
    explanations,
    advisories,
    advisoryCount,
    signals,
    blastRadius: {
      consumerCount: Number(ceRows[0]?.count ?? 0),
      minDepth: ceRows[0]?.min_depth,
      maxDepth: ceRows[0]?.max_depth,
    },
  })
})

// GET /packages/:ecosystem/:name/versions
router.get('/:ecosystem/:name/versions', async (c) => {
  const { ecosystem, name } = c.req.param()

  const pkgResult = await db.execute(sql.raw(`
    SELECT id FROM packages WHERE ecosystem = '${ecosystem}' AND name = '${name}' LIMIT 1
  `))
  const pkgRows = (pkgResult.rows ?? pkgResult) as Array<{ id: string }>
  if (pkgRows.length === 0) return err(c, 'Package not found', 404, 'NOT_FOUND')

  const result = await db.execute(sql.raw(`
    SELECT version, published_at, deprecated, has_types, license
    FROM versions
    WHERE package_id = '${pkgRows[0].id}'
    ORDER BY published_at DESC
  `))
  return ok(c, (result.rows ?? result))
})

// GET /packages/:ecosystem/:name/history
router.get('/:ecosystem/:name/history', async (c) => {
  const { ecosystem, name } = c.req.param()
  const limit = Number(c.req.query('limit') ?? 10)

  const pkgResult = await db.execute(sql.raw(`
    SELECT id FROM packages WHERE ecosystem = '${ecosystem}' AND name = '${name}' LIMIT 1
  `))
  const pkgRows = (pkgResult.rows ?? pkgResult) as Array<{ id: string }>
  if (pkgRows.length === 0) return err(c, 'Package not found', 404, 'NOT_FOUND')

  const result = await db.execute(sql.raw(`
    SELECT composite_score, security_score, maintenance_score, compatibility_score,
           concentration_score, blast_radius_score, operational_score, scored_at
    FROM risk_scores
    WHERE package_id = '${pkgRows[0].id}'
    ORDER BY scored_at DESC
    LIMIT ${Math.min(limit, 100)}
  `))
  return ok(c, (result.rows ?? result))
})

// GET /packages/:ecosystem/:name/advisories
router.get('/:ecosystem/:name/advisories', async (c) => {
  const { ecosystem, name } = c.req.param()

  const pkgResult = await db.execute(sql.raw(`
    SELECT id FROM packages WHERE ecosystem = '${ecosystem}' AND name = '${name}' LIMIT 1
  `))
  const pkgRows = (pkgResult.rows ?? pkgResult) as Array<{ id: string }>
  if (pkgRows.length === 0) return err(c, 'Package not found', 404, 'NOT_FOUND')

  const result = await db.execute(sql.raw(`
    SELECT a.id, a.osv_id, a.title, a.description, a.severity, a.cvss_score,
           a.published_at, a.modified_at, a.withdrawn_at, a.aliases,
           json_agg(json_build_object('version_range', av.version_range, 'fixed_version', av.fixed_version)) AS affected_versions
    FROM advisories a
    LEFT JOIN advisory_affected_versions av ON av.advisory_id = a.id
    WHERE a.package_id = '${pkgRows[0].id}'
    GROUP BY a.id
    ORDER BY a.cvss_score DESC NULLS LAST
  `))
  return ok(c, (result.rows ?? result))
})

export { router as packagesRouter }
