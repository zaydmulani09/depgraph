import type { Redis } from 'ioredis'

const SEEN_KEY = 'depgraph:seen'
const TTL_SECONDS = 60 * 60 * 24 // 24 hours

export class CrawlDedup {
  constructor(private readonly redis: Redis) {}

  async isSeen(key: string): Promise<boolean> {
    const result = await this.redis.sismember(SEEN_KEY, key)
    return result === 1
  }

  async markSeen(key: string): Promise<void> {
    await this.redis.sadd(SEEN_KEY, key)
    await this.redis.expire(SEEN_KEY, TTL_SECONDS)
  }

  async clear(): Promise<void> {
    await this.redis.del(SEEN_KEY)
  }
}
