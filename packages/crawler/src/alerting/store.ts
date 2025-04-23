import type { Redis } from 'ioredis'
import type { DepgraphAlert, AlertType } from './types'

const ALERTS_KEY = 'depgraph:alerts:recent'
const MAX_ALERTS = 500

export class AlertStore {
  constructor(private redis: Redis) {}

  async save(alert: DepgraphAlert): Promise<void> {
    const score = new Date(alert.createdAt).getTime()
    await this.redis.zadd(ALERTS_KEY, score, JSON.stringify(alert))
    const count = await this.redis.zcard(ALERTS_KEY)
    if (count > MAX_ALERTS) {
      await this.redis.zremrangebyrank(ALERTS_KEY, 0, count - MAX_ALERTS - 1)
    }
  }

  async getRecent(options?: {
    limit?: number
    type?: AlertType
    since?: number
  }): Promise<DepgraphAlert[]> {
    const limit = options?.limit ?? 50

    let raw: string[]
    if (options?.since != null) {
      raw = await this.redis.zrangebyscore(
        ALERTS_KEY,
        options.since,
        '+inf',
        'LIMIT',
        0,
        limit * 2
      )
      raw = raw.reverse()
    } else {
      raw = await this.redis.zrevrange(ALERTS_KEY, 0, limit - 1)
    }

    const alerts = raw
      .map((s) => {
        try {
          return JSON.parse(s) as DepgraphAlert
        } catch {
          return null
        }
      })
      .filter((a): a is DepgraphAlert => a !== null)

    if (options?.type) {
      return alerts.filter((a) => a.type === options.type).slice(0, limit)
    }

    return alerts.slice(0, limit)
  }

  async getCount(): Promise<number> {
    return this.redis.zcard(ALERTS_KEY)
  }

  async clear(): Promise<void> {
    await this.redis.del(ALERTS_KEY)
  }
}
