import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { rateLimitMiddleware } from './rate-limit'

function makeApp(maxRequests = 3) {
  const app = new Hono()
  app.use('*', rateLimitMiddleware({ windowMs: 60_000, maxRequests }))
  app.get('/', (c) => c.json({ ok: true }))
  return app
}

describe('rateLimitMiddleware', () => {
  it('allows requests under limit', async () => {
    const app = makeApp(5)
    const res = await app.request('/')
    expect(res.status).toBe(200)
  })

  it('returns 429 after exceeding maxRequests', async () => {
    const app = makeApp(2)
    // exhaust limit
    await app.request('/')
    await app.request('/')
    // 3rd should be blocked
    const res = await app.request('/')
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toBe('Too Many Requests')
    expect(typeof body.retryAfter).toBe('number')
  })

  it('sets X-RateLimit-Remaining header that decrements', async () => {
    const app = makeApp(10)
    const res1 = await app.request('/')
    const res2 = await app.request('/')
    const rem1 = Number(res1.headers.get('x-ratelimit-remaining'))
    const rem2 = Number(res2.headers.get('x-ratelimit-remaining'))
    expect(rem2).toBeLessThan(rem1)
  })

  it('sets X-RateLimit-Limit header', async () => {
    const app = makeApp(7)
    const res = await app.request('/')
    expect(res.headers.get('x-ratelimit-limit')).toBe('7')
  })

  it('sets X-RateLimit-Reset header as a number', async () => {
    const app = makeApp(10)
    const res = await app.request('/')
    const reset = Number(res.headers.get('x-ratelimit-reset'))
    expect(reset).toBeGreaterThan(Date.now() - 1000)
  })
})
