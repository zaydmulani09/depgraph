import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { db as DbType } from '@depgraph/db'

vi.mock('@depgraph/risk', () => ({
  scorePackageBatch: vi.fn(),
}))

import { scorePackageBatch } from '@depgraph/risk'
import { runScoringBenchmark } from './scoring-benchmark'

const mockDb = null as unknown as typeof DbType

function makeMockResults(ids: string[], composite = 0.4) {
  return ids.map((id) => ({
    packageId: id,
    result: {
      packageId: id,
      security: { score: 0.2, explanations: [] },
      maintenance: { score: 0.3, explanations: [] },
      compatibility: { score: 0.1, explanations: [] },
      concentration: { score: 0.4, explanations: [] },
      blast_radius: { score: 0.5, explanations: [] },
      operational: { score: 0.2, explanations: [] },
      composite,
      explanations: [
        {
          factor_name: 'test_factor',
          dimension: 'security',
          contribution_pct: 30,
          raw_value: 1,
          description: 'Test explanation',
        },
      ],
    },
  }))
}

describe('runScoringBenchmark', () => {
  beforeEach(() => {
    vi.mocked(scorePackageBatch).mockReset()
  })

  it('2 runs with same results → inconsistentPackages === []', async () => {
    const ids = ['pkg-1', 'pkg-2']
    vi.mocked(scorePackageBatch).mockResolvedValue(makeMockResults(ids))

    const result = await runScoringBenchmark({
      db: mockDb,
      packageIds: ids,
      runs: 2,
    })

    expect(result.scoreConsistency.inconsistentPackages).toEqual([])
    expect(result.scoreConsistency.maxVariance).toBe(0)
  })

  it('packagesPerSecond > 0 when packages are scored', async () => {
    const ids = ['pkg-1']
    vi.mocked(scorePackageBatch).mockResolvedValue(makeMockResults(ids))

    const result = await runScoringBenchmark({
      db: mockDb,
      packageIds: ids,
      runs: 1,
    })

    expect(result.packagesPerSecond).toBeGreaterThan(0)
  })

  it('explanationCoverage === 1.0 when all packages have explanations', async () => {
    const ids = ['pkg-1', 'pkg-2', 'pkg-3']
    vi.mocked(scorePackageBatch).mockResolvedValue(makeMockResults(ids))

    const result = await runScoringBenchmark({
      db: mockDb,
      packageIds: ids,
      runs: 1,
    })

    expect(result.explanationCoverage).toBe(1)
  })

  it('timing metrics are non-zero after scoring', async () => {
    const ids = ['pkg-1', 'pkg-2']
    vi.mocked(scorePackageBatch).mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5))
      return makeMockResults(ids)
    })

    const result = await runScoringBenchmark({
      db: mockDb,
      packageIds: ids,
      runs: 1,
    })

    expect(result.totalDurationMs).toBeGreaterThan(0)
    expect(result.avgDurationPerPackageMs).toBeGreaterThan(0)
  })

  it('detects score inconsistency when composite varies between runs', async () => {
    const ids = ['pkg-1']
    vi.mocked(scorePackageBatch)
      .mockResolvedValueOnce(makeMockResults(ids, 0.2))
      .mockResolvedValueOnce(makeMockResults(ids, 0.9))

    const result = await runScoringBenchmark({
      db: mockDb,
      packageIds: ids,
      runs: 2,
    })

    expect(result.scoreConsistency.inconsistentPackages).toContain('pkg-1')
    expect(result.scoreConsistency.maxVariance).toBeGreaterThan(0.1)
  })
})
