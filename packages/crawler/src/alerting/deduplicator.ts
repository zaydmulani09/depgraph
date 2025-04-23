import type { Redis } from 'ioredis'
import type { DepgraphAlert, AlertRule } from './types'

const KEY_PREFIX = 'depgraph:alert:dedup:'

export class AlertDeduplicator {
  constructor(private redis: Redis) {}

  async isDuplicate(alert: DepgraphAlert, throttleMinutes: number): Promise<boolean> {
    const key = `${KEY_PREFIX}${alert.deduplicationKey}`
    const exists = await this.redis.exists(key)
    return exists === 1
  }

  async markSent(alert: DepgraphAlert, throttleMinutes: number): Promise<void> {
    const key = `${KEY_PREFIX}${alert.deduplicationKey}`
    await this.redis.set(key, '1', 'EX', throttleMinutes * 60)
  }

  async filterDuplicates(alerts: DepgraphAlert[], rules: AlertRule[]): Promise<DepgraphAlert[]> {
    const fresh: DepgraphAlert[] = []

    for (const alert of alerts) {
      const rule = rules.find((r) => r.type === alert.type)
      const throttleMinutes = rule?.throttleMinutes ?? 60
      const duplicate = await this.isDuplicate(alert, throttleMinutes)
      if (!duplicate) {
        fresh.push(alert)
      }
    }

    return fresh
  }
}
