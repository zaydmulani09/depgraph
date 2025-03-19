import { describe, it, expect, vi, beforeEach } from 'vitest'
import { app } from '../app'

vi.mock('@depgraph/db', () => ({
  db: {
    execute: vi.fn(),
  },
}))

vi.mock('@depgraph/crawler/src/normalization/chokepoint-detector', () => ({
  detectCrossEcosystemChokepoints: vi.fn().mockResolvedValue([
    {
      packageId: 'pkg-1',
      packageName: 'lodash',
      ecosystem: 'npm',
      directConsumers: 100,
      transitiveConsumers: 100,
      ecosystemsAffected: [],
      chokepointScore: 80,
      reason: 'test',
    },
  ]),
}))

import { db } from '@depgraph/db'

const mockDb = db as unknown as { execute: ReturnType<typeof vi.fn> }

const SUMMARY_MOCK = {
  pkgCount: [{ total: '42' }],
  versionCount: [{ total: '120' }],
  advisoryCount: [{ total: '5' }],
  scoreStats: [{ avg_score: 45.5, max_score: 90.0 }],
  distrib: [{ critical: '2', high: '5', medium: '10', low: '20', unscored: '5' }],
  violations: [{ active_violations: '3', block_violations: '1' }],
  snapshot: [{ id: 'snap-uuid', snapshotted_at: '2024-01-01T00:00:00Z' }],
  ecosystems: [
    { ecosystem: 'npm', cnt: '30' },
    { ecosystem: 'pypi', cnt: '8' },
    { ecosystem: 'cargo', cnt: '4' },
  ],
}

function mockSummaryResponses() {
  let call = 0
  mockDb.execute.mockImplementation(async () => {
    const responses = [
      { rows: SUMMARY_MOCK.pkgCount },
      { rows: SUMMARY_MOCK.versionCount },
      { rows: SUMMARY_MOCK.advisoryCount },
      { rows: SUMMARY_MOCK.scoreStats },
      { rows: SUMMARY_MOCK.distrib },
      { rows: SUMMARY_MOCK.violations },
      { rows: SUMMARY_MOCK.snapshot },
      { rows: SUMMARY_MOCK.ecosystems },
    ]
    return responses[call++] ?? { rows: [] }
  })
}

describe('GET /portfolio/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
  })

  it('returns 200 with correct shape', async () => {
    mockSummaryResponses()
    const res = await app.request('/portfolio/summary')
    expect(res.status).toBe(200)
    const body = await res.json() as { data: Record<string, unknown> }
    expect(body.data).toHaveProperty('totalPackages')
    expect(body.data).toHaveProperty('scoreDistribution')
    expect(body.data).toHaveProperty('packagesByEcosystem')
    expect(body.data.packagesByEcosystem).toHaveProperty('npm')
  })

  it('scoreDistribution has all 5 keys', async () => {
    mockSummaryResponses()
    const res = await app.request('/portfolio/summary')
    const body = await res.json() as { data: { scoreDistribution: Record<string, number> } }
    const dist = body.data.scoreDistribution
    expect(dist).toHaveProperty('critical')
    expect(dist).toHaveProperty('high')
    expect(dist).toHaveProperty('medium')
    expect(dist).toHaveProperty('low')
    expect(dist).toHaveProperty('unscored')
  })
})

describe('GET /portfolio/top-risky', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
  })

  it('returns 200 with an array', async () => {
    mockDb.execute.mockResolvedValue({
      rows: [
        { id: 'p1', name: 'lodash', ecosystem: 'npm', composite_score: 85 },
      ],
    })
    const res = await app.request('/portfolio/top-risky')
    expect(res.status).toBe(200)
    const body = await res.json() as { data: unknown[] }
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('respects limit param', async () => {
    mockDb.execute.mockResolvedValue({ rows: [] })
    const res = await app.request('/portfolio/top-risky?limit=5')
    expect(res.status).toBe(200)
  })
})

describe('GET /portfolio/chokepoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
  })

  it('returns 200 with an array', async () => {
    const res = await app.request('/portfolio/chokepoints')
    expect(res.status).toBe(200)
    const body = await res.json() as { data: unknown[] }
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('filters by ecosystem param', async () => {
    const res = await app.request('/portfolio/chokepoints?ecosystem=npm')
    expect(res.status).toBe(200)
    const body = await res.json() as { data: Array<{ ecosystem: string }> }
    for (const item of body.data) {
      expect(item.ecosystem).toBe('npm')
    }
  })
})

describe('GET /portfolio/ecosystem-breakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
  })

  it('returns 200 with array of 3 entries', async () => {
    mockDb.execute.mockResolvedValue({
      rows: [{ package_count: '10', avg_score: 40, max_score: 80, critical_count: '1', advisory_count: '2' }],
    })
    const res = await app.request('/portfolio/ecosystem-breakdown')
    expect(res.status).toBe(200)
    const body = await res.json() as { data: unknown[] }
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data).toHaveLength(3)
  })
})

describe('GET /portfolio/trend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
  })

  it('returns 200 with an array', async () => {
    mockDb.execute.mockResolvedValue({
      rows: [
        {
          id: 'snap-1',
          label: null,
          package_count: 100,
          avg_composite_score: 45,
          max_composite_score: 90,
          violation_count: 2,
          snapshotted_at: '2024-01-01T00:00:00Z',
        },
      ],
    })
    const res = await app.request('/portfolio/trend')
    expect(res.status).toBe(200)
    const body = await res.json() as { data: unknown[] }
    expect(Array.isArray(body.data)).toBe(true)
  })
})

describe('Auth enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'production'
  })

  it('returns 401 on /portfolio/summary without API key', async () => {
    const res = await app.request('/portfolio/summary')
    expect(res.status).toBe(401)
  })

  it('returns 401 on /portfolio/top-risky without API key', async () => {
    const res = await app.request('/portfolio/top-risky')
    expect(res.status).toBe(401)
  })

  it('returns 401 on /portfolio/trend without API key', async () => {
    const res = await app.request('/portfolio/trend')
    expect(res.status).toBe(401)
  })
})
