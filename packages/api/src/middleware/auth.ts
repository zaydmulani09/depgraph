import type { MiddlewareHandler } from 'hono'

export const apiKeyAuth: MiddlewareHandler = async (c, next) => {
  const headerKey = c.req.header('x-api-key')
  const envKey = process.env.API_KEY ?? 'dev-secret-key'
  const isDev = process.env.NODE_ENV !== 'production'

  // Dev bypass: no key provided in dev mode
  if (isDev && !headerKey) {
    await next()
    return
  }

  if (!headerKey || headerKey !== envKey) {
    return c.json({ error: 'Unauthorized', code: 'INVALID_API_KEY' }, 401)
  }

  await next()
}
