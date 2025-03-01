import type { Redis } from 'ioredis'
import type { OsvEcosystem } from './client'

export class OsvSyncCursor {
  constructor(private readonly redis: Redis) {}

  private key(ecosystem: OsvEcosystem): string {
    return `depgraph:osv:cursor:${ecosystem}`
  }

  async getLastSync(ecosystem: OsvEcosystem): Promise<string | null> {
    return this.redis.get(this.key(ecosystem))
  }

  async setLastSync(ecosystem: OsvEcosystem, timestamp: string): Promise<void> {
    await this.redis.set(this.key(ecosystem), timestamp)
  }

  async clearAll(): Promise<void> {
    const keys = await this.redis.keys('depgraph:osv:cursor:*')
    if (keys.length > 0) {
      await this.redis.del(...keys)
    }
  }
}
