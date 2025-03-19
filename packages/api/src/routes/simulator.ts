import { Hono } from 'hono'
import { db } from '@depgraph/db'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { ok, err } from '../lib/response'
import { simulateUpgrade } from '@depgraph/crawler/src/simulator/simulator'

const router = new Hono()

const upgradeSchema = z.object({
  packageName: z.string().min(1),
  ecosystem: z.enum(['npm', 'pypi', 'cargo']),
  fromVersion: z.string().min(1),
  toVersion: z.string().min(1),
})

// POST /simulate/upgrade
router.post('/upgrade', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return err(c, 'Invalid JSON body', 400, 'BAD_REQUEST')
  }

  const parsed = upgradeSchema.safeParse(body)
  if (!parsed.success) {
    return err(c, parsed.error.issues.map((i) => i.message).join(', '), 400, 'VALIDATION_ERROR')
  }

  try {
    const result = await simulateUpgrade(db, parsed.data)
    return ok(c, result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Simulation failed'
    if (msg.includes('not found')) return err(c, msg, 404, 'NOT_FOUND')
    return err(c, msg, 400, 'SIMULATION_ERROR')
  }
})

// GET /simulate/upgrade/history
router.get('/upgrade/history', async (c) => {
  const packageId = c.req.query('packageId')
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)

  const pkgFilter = packageId ? `AND package_id = '${packageId}'` : ''

  const result = await db.execute(sql.raw(`
    SELECT ue.id, ue.package_id, p.name AS package_name, p.ecosystem,
           ue.from_version, ue.to_version, ue.is_breaking, ue.score_delta, ue.evaluated_at
    FROM upgrade_events ue
    JOIN packages p ON p.id = ue.package_id
    WHERE ue.simulated = true ${pkgFilter}
    ORDER BY ue.evaluated_at DESC
    LIMIT ${limit}
  `))

  return ok(c, (result.rows ?? result))
})

export { router as simulatorRouter }
