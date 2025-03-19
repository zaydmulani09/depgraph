import { describe, it, expect, afterEach } from 'vitest'
import { Hono } from 'hono'
import { apiKeyAuth } from './auth'

function makeApp() {
  const app = new Hono()
  app.use('*', apiKeyAuth)
  app.get('/', (c) => c.json({ ok: true }))
  return app
}

const VALID_KEY = process.env.API_KEY ?? 'dev-secret-key'

describe('apiKeyAuth middleware', () => {
  it('passes through with correct API key in production mode', async () => {
    const orig = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const app = makeApp()
      const res = await app.request('/', { headers: { 'x-api-key': VALID_KEY } })
      expect(res.status).toBe(200)
    } finally {
      process.env.NODE_ENV = orig
    }
  })

  it('returns 401 for missing key in production mode', async () => {
    const orig = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const app = makeApp()
      const res = await app.request('/')
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.code).toBe('INVALID_API_KEY')
    } finally {
      process.env.NODE_ENV = orig
    }
  })

  it('returns 401 for wrong API key', async () => {
    const orig = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const app = makeApp()
      const res = await app.request('/', { headers: { 'x-api-key': 'wrong-key' } })
      expect(res.status).toBe(401)
    } finally {
      process.env.NODE_ENV = orig
    }
  })

  it('bypasses auth in development mode when no key provided', async () => {
    const origEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    try {
      const app = makeApp()
      const res = await app.request('/')
      expect(res.status).toBe(200)
    } finally {
      process.env.NODE_ENV = origEnv
    }
  })

  it('validates key even in development mode when key IS provided', async () => {
    const origEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    try {
      const app = makeApp()
      const res = await app.request('/', { headers: { 'x-api-key': 'wrong-key' } })
      expect(res.status).toBe(401)
    } finally {
      process.env.NODE_ENV = origEnv
    }
  })
})
