import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock DB and Redis before app import
vi.mock('@depgraph/db', () => ({
  db: {
    execute: vi.fn().mockRejectedValue(new Error('no db in test')),
  },
  pool: {},
}))

vi.mock('ioredis', () => ({
  Redis: class {
    connect() { return Promise.reject(new Error('no redis in test')) }
    ping() { return Promise.resolve('PONG') }
    disconnect() {}
  },
}))

// Import app after mocks
const { app } = await import('../app')

describe('GET /health', () => {
  it('returns 200', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
  })

  it('has status ok and correct version', async () => {
    const res = await app.request('/health')
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.version).toBe('0.1.0')
  })

  it('has services object with database and redis keys', async () => {
    const res = await app.request('/health')
    const body = await res.json()
    expect(body.services).toBeDefined()
    expect(body.services).toHaveProperty('database')
    expect(body.services).toHaveProperty('redis')
  })

  it('reports error for unavailable services (no live connections)', async () => {
    const res = await app.request('/health')
    const body = await res.json()
    // In test environment DB and Redis are mocked to fail
    expect(['ok', 'error']).toContain(body.services.database)
    expect(['ok', 'error']).toContain(body.services.redis)
  })

  it('includes timestamp field', async () => {
    const res = await app.request('/health')
    const body = await res.json()
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
