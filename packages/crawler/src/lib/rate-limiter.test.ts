import { describe, it, expect, vi } from 'vitest'
import { RateLimiter } from './rate-limiter'

describe('RateLimiter', () => {
  it('resolves immediately when tokens are available', async () => {
    const limiter = new RateLimiter({ requestsPerSecond: 10 })
    const start = Date.now()
    await limiter.throttle()
    expect(Date.now() - start).toBeLessThan(50)
  })

  it('delays on 3rd call with requestsPerSecond: 2 within 1 second', async () => {
    const limiter = new RateLimiter({ requestsPerSecond: 2 })
    const start = Date.now()
    await limiter.throttle() // token 1 — immediate
    await limiter.throttle() // token 2 — immediate
    await limiter.throttle() // no tokens left — must wait
    const elapsed = Date.now() - start
    // Should have waited at least ~400ms (2 tokens at 2/sec = 500ms refill period)
    expect(elapsed).toBeGreaterThan(300)
  }, 5000)

  it('concurrent callers all eventually resolve', async () => {
    const limiter = new RateLimiter({ requestsPerSecond: 20 })
    const results = await Promise.all(
      Array.from({ length: 5 }, () => limiter.throttle())
    )
    expect(results).toHaveLength(5)
    // All resolved (no errors, all void)
    for (const r of results) {
      expect(r).toBeUndefined()
    }
  })
})
