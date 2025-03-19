import type { MiddlewareHandler } from 'hono'

interface WindowEntry {
  count: number
  resetAt: number
}

export function rateLimitMiddleware(options?: {
  windowMs?: number
  maxRequests?: number
}): MiddlewareHandler {
  const windowMs = options?.windowMs ?? 60_000
  const maxRequests = options?.maxRequests ?? 100
  const store = new Map<string, WindowEntry>()

  return async (c, next) => {
    const ip = c.req.header('x-forwarded-for') ?? 'unknown'
    const now = Date.now()

    let entry = store.get(ip)
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      store.set(ip, entry)
    }

    entry.count++
    const remaining = Math.max(0, maxRequests - entry.count)
    const resetSecs = Math.ceil((entry.resetAt - now) / 1000)

    c.header('X-RateLimit-Limit', String(maxRequests))
    c.header('X-RateLimit-Remaining', String(remaining))
    c.header('X-RateLimit-Reset', String(entry.resetAt))

    if (entry.count > maxRequests) {
      return c.json({ error: 'Too Many Requests', retryAfter: resetSecs }, 429)
    }

    await next()
  }
}
