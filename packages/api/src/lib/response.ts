import type { Context } from 'hono'

function meta(status: number) {
  return { timestamp: new Date().toISOString(), status }
}

export function ok<T>(c: Context, data: T, status = 200): Response {
  return c.json({ data, meta: meta(status) }, status as 200)
}

export function err(c: Context, message: string, status = 400, code?: string): Response {
  return c.json({ error: message, code, meta: meta(status) }, status as 400)
}

export function paginated<T>(
  c: Context,
  items: T[],
  total: number,
  page: number,
  limit: number
): Response {
  return c.json({
    data: items,
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      ...meta(200),
    },
  })
}
