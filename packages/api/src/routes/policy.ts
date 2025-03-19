import { Hono } from 'hono'
import { db, policyRules, policyViolations } from '@depgraph/db'
import { sql, eq, isNull, isNotNull } from 'drizzle-orm'
import { z } from 'zod'
import { ok, err, paginated } from '../lib/response'
import { parseQuery } from '../lib/validate'
import { getSnapshot } from '@depgraph/crawler/src/snapshots/persister'
import { loadEnabledRules } from '@depgraph/crawler/src/policy/seeder'
import { evaluateRules } from '@depgraph/crawler/src/policy/engine'

const router = new Hono()

// GET /policy/rules
router.get('/rules', async (c) => {
  const rules = await db.select().from(policyRules).orderBy(policyRules.created_at)
  return ok(c, rules)
})

// GET /policy/violations
const violationsSchema = z.object({
  packageId: z.string().uuid().optional(),
  action: z.enum(['block', 'warn', 'require_approval']).optional(),
  resolved: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

router.get('/violations', async (c) => {
  const parsed = parseQuery(c, violationsSchema)
  if (!parsed.success) return parsed.response
  const { packageId, action, resolved, page, limit } = parsed.data as z.infer<typeof violationsSchema>
  const offset = (page - 1) * limit

  const conditions: string[] = []
  if (packageId) conditions.push(`pv.package_id = '${packageId}'`)
  if (action) conditions.push(`pv.action = '${action}'`)
  if (!resolved) conditions.push(`pv.resolved_at IS NULL`)
  else conditions.push(`pv.resolved_at IS NOT NULL`)

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const dataResult = await db.execute(sql.raw(`
    SELECT pv.id, pv.action, pv.remediation, pv.resolved_at, pv.created_at,
           p.name AS package_name, p.ecosystem,
           pr.name AS rule_name
    FROM policy_violations pv
    JOIN packages p ON p.id = pv.package_id
    JOIN policy_rules pr ON pr.id = pv.rule_id
    ${where}
    ORDER BY pv.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `))

  const countResult = await db.execute(sql.raw(`
    SELECT COUNT(*) AS total FROM policy_violations pv ${where}
  `))

  const rows = (dataResult.rows ?? dataResult) as unknown[]
  const countRows = (countResult.rows ?? countResult) as Array<{ total: string | number }>
  const total = Number(countRows[0]?.total ?? 0)

  return paginated(c, rows, total, page, limit)
})

// POST /policy/evaluate
router.post('/evaluate', async (c) => {
  let body: { snapshotId?: string }
  try {
    body = await c.req.json()
  } catch {
    return err(c, 'Invalid JSON body', 400, 'BAD_REQUEST')
  }

  const { snapshotId } = body
  if (!snapshotId) return err(c, 'snapshotId required', 400, 'VALIDATION_ERROR')

  const snap = await getSnapshot(db, snapshotId)
  if (!snap) return err(c, 'Snapshot not found', 404, 'NOT_FOUND')

  const rules = await loadEnabledRules(db)
  const violations = evaluateRules(rules, snap.packages)
  return ok(c, violations)
})

// PATCH /policy/violations/:id/resolve
router.patch('/violations/:id/resolve', async (c) => {
  const { id } = c.req.param()

  const [updated] = await db
    .update(policyViolations)
    .set({ resolved_at: new Date() })
    .where(eq(policyViolations.id, id))
    .returning()

  if (!updated) return err(c, 'Violation not found', 404, 'NOT_FOUND')
  return ok(c, updated)
})

export { router as policyRouter }
