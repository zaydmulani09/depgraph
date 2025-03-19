import type { Context } from 'hono'
import type { ZodSchema } from 'zod'
import { err } from './response'

export function parseQuery(
  c: Context,
  schema: ZodSchema
): { success: true; data: unknown } | { success: false; response: Response } {
  const result = schema.safeParse(c.req.query())
  if (!result.success) {
    return {
      success: false,
      response: err(c, result.error.issues.map((i) => i.message).join(', '), 400, 'VALIDATION_ERROR'),
    }
  }
  return { success: true, data: result.data }
}
