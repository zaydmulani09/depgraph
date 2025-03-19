import { Hono } from 'hono'
import { db } from '@depgraph/db'
import { sql } from 'drizzle-orm'
import { Redis } from 'ioredis'

const router = new Hono()

async function checkDb(): Promise<'ok' | 'error'> {
  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ])
    return 'ok'
  } catch {
    return 'error'
  }
}

async function checkRedis(): Promise<'ok' | 'error'> {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  })
  try {
    await Promise.race([
      (async () => {
        await redis.connect()
        await redis.ping()
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ])
    return 'ok'
  } catch {
    return 'error'
  } finally {
    try { redis.disconnect() } catch {}
  }
}

router.get('/', async (c) => {
  const [database, redis] = await Promise.all([checkDb(), checkRedis()])
  return c.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    services: { database, redis },
  })
})

export { router as healthRouter }
