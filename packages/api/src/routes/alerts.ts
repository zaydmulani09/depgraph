import { Hono } from 'hono'
import { Redis } from 'ioredis'
import { z } from 'zod'
import { ok, err } from '../lib/response'
import { parseQuery } from '../lib/validate'
import { AlertStore } from '@depgraph/crawler/src/alerting/store'

const router = new Hono()

function getRedis(): Redis {
  return new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    lazyConnect: false,
  })
}

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  type: z.enum(['new_vulnerability', 'maintainer_collapse', 'score_spike', 'bus_factor_one']).optional(),
  since: z.coerce.number().optional(),
})

// GET /alerts
router.get('/', async (c) => {
  const parsed = parseQuery(c, listSchema)
  if (!parsed.success) return parsed.response

  const { limit, type, since } = parsed.data as z.infer<typeof listSchema>

  const redis = getRedis()
  try {
    const store = new AlertStore(redis)
    const alerts = await store.getRecent({ limit, type, since })
    return ok(c, alerts)
  } finally {
    await redis.quit()
  }
})

// GET /alerts/count
router.get('/count', async (c) => {
  const redis = getRedis()
  try {
    const store = new AlertStore(redis)
    const count = await store.getCount()
    return ok(c, { count })
  } finally {
    await redis.quit()
  }
})

// DELETE /alerts
router.delete('/', async (c) => {
  const redis = getRedis()
  try {
    const store = new AlertStore(redis)
    await store.clear()
    return ok(c, { cleared: true })
  } finally {
    await redis.quit()
  }
})

export { router as alertsRouter }
