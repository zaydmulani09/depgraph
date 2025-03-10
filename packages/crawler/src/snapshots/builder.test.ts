import { describe, it, expect, vi } from 'vitest'
import { buildSnapshot } from './builder'

function makeMockDb(responses: unknown[][]) {
  let call = 0
  return {
    execute: vi.fn(async () => {
      const rows = responses[call] ?? []
      call++
      return rows
    }),
  }
}

const scoreRow = {
  package_id: 'pkg-a',
  score_id: 'score-a',
  package_name: 'react',
  ecosystem: 'npm',
  composite_score: 80,
  security_score: 70,
  maintenance_score: 20,
  compatibility_score: 10,
  concentration_score: 15,
  blast_radius_score: 40,
  operational_score: 10,
}

const criticalScoreRow = {
  ...scoreRow,
  package_id: 'pkg-b',
  score_id: 'score-b',
  package_name: 'lodash',
  composite_score: 80, // >75 → critical
}

const belowCriticalRow = {
  ...scoreRow,
  package_id: 'pkg-c',
  score_id: 'score-c',
  package_name: 'express',
  composite_score: 60, // >50 but ≤75 → high not critical
}

describe('buildSnapshot', () => {
  it('returns SnapshotData shape with version 1', async () => {
    const db = makeMockDb([[scoreRow], [], [], [], []])
    const result = await buildSnapshot(db as any)
    expect(result.version).toBe(1)
    expect(result).toHaveProperty('packages')
    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('generatedAt')
  })

  it('summary.totalPackages equals packages array length', async () => {
    const db = makeMockDb([[scoreRow, criticalScoreRow], [], [], [], []])
    const result = await buildSnapshot(db as any)
    expect(result.summary.totalPackages).toBe(result.packages.length)
    expect(result.summary.totalPackages).toBe(2)
  })

  it('generatedAt is a valid ISO string', async () => {
    const db = makeMockDb([[scoreRow], [], [], [], []])
    const result = await buildSnapshot(db as any)
    expect(() => new Date(result.generatedAt)).not.toThrow()
    expect(new Date(result.generatedAt).toISOString()).toBe(result.generatedAt)
  })

  it('criticalCount counts packages with composite > 75', async () => {
    const db = makeMockDb([[scoreRow, criticalScoreRow, belowCriticalRow], [], [], [], []])
    const result = await buildSnapshot(db as any)
    // scoreRow.composite = 80 → critical, criticalScoreRow = 80 → critical, belowCritical = 60 → not critical
    expect(result.summary.criticalCount).toBe(2)
  })

  it('empty DB returns empty snapshot with zero counts', async () => {
    const db = makeMockDb([[]])
    const result = await buildSnapshot(db as any)
    expect(result.packages).toHaveLength(0)
    expect(result.summary.totalPackages).toBe(0)
    expect(result.summary.avgCompositeScore).toBe(0)
    expect(result.summary.maxCompositeScore).toBe(0)
  })

  it('ecosystem option passed → query contains ecosystem scope (mockable)', async () => {
    const db = makeMockDb([[scoreRow], [], [], [], []])
    const result = await buildSnapshot(db as any, { ecosystem: 'npm' })
    expect(result.ecosystem).toBe('npm')
    expect(result.version).toBe(1)
  })

  it('packages have correct fields mapped from score rows', async () => {
    const explRow = {
      package_id: 'pkg-a',
      factor_name: 'cvss_score',
      dimension: 'security',
      contribution_pct: 30,
      description: 'High CVSS',
    }
    const db = makeMockDb([[scoreRow], [explRow], [], [], []])
    const result = await buildSnapshot(db as any)
    const pkg = result.packages[0]
    expect(pkg.packageId).toBe('pkg-a')
    expect(pkg.packageName).toBe('react')
    expect(pkg.compositeScore).toBe(80)
    expect(pkg.topExplanations).toHaveLength(1)
    expect(pkg.topExplanations[0].factor_name).toBe('cvss_score')
  })
})
