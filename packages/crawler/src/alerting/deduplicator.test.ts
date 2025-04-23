import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AlertDeduplicator } from './deduplicator'
import type { DepgraphAlert, AlertRule } from './types'

function makeAlert(overrides: Partial<DepgraphAlert> = {}): DepgraphAlert {
  return {
    id: 'test-id',
    type: 'score_spike',
    severity: 'high',
    packageId: 'pkg-1',
    packageName: 'lodash',
    ecosystem: 'npm',
    title: 'Score spike',
    message: 'Score increased',
    metadata: {},
    snapshotId: 'snap-1',
    createdAt: new Date().toISOString(),
    deduplicationKey: 'score_spike:pkg-1:10',
    ...overrides,
  }
}

function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    type: 'score_spike',
    enabled: true,
    severity: 'high',
    delivery: ['log_only'],
    throttleMinutes: 120,
    ...overrides,
  }
}

function makeMockRedis(existsResult: number) {
  return {
    exists: vi.fn().mockResolvedValue(existsResult),
    set: vi.fn().mockResolvedValue('OK'),
  } as any
}

describe('AlertDeduplicator', () => {
  it('isDuplicate returns false when key does not exist', async () => {
    const redis = makeMockRedis(0)
    const dedup = new AlertDeduplicator(redis)
    const result = await dedup.isDuplicate(makeAlert(), 60)
    expect(result).toBe(false)
  })

  it('isDuplicate returns true when key exists', async () => {
    const redis = makeMockRedis(1)
    const dedup = new AlertDeduplicator(redis)
    const result = await dedup.isDuplicate(makeAlert(), 60)
    expect(result).toBe(true)
  })

  it('markSent sets key with correct TTL', async () => {
    const redis = makeMockRedis(0)
    const dedup = new AlertDeduplicator(redis)
    const alert = makeAlert()
    await dedup.markSent(alert, 120)
    expect(redis.set).toHaveBeenCalledWith(
      `depgraph:alert:dedup:${alert.deduplicationKey}`,
      '1',
      'EX',
      120 * 60
    )
  })

  it('filterDuplicates removes alerts already sent', async () => {
    const redis = {
      exists: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
      set: vi.fn(),
    } as any
    const dedup = new AlertDeduplicator(redis)
    const alerts = [makeAlert({ deduplicationKey: 'dup' }), makeAlert({ deduplicationKey: 'fresh' })]
    const rules = [makeRule()]
    const result = await dedup.filterDuplicates(alerts, rules)
    expect(result).toHaveLength(1)
    expect(result[0].deduplicationKey).toBe('fresh')
  })

  it('filterDuplicates uses rule throttleMinutes when available', async () => {
    const redis = makeMockRedis(0)
    const dedup = new AlertDeduplicator(redis)
    const alert = makeAlert({ type: 'maintainer_collapse', deduplicationKey: 'mc:pkg-1' })
    const rules = [makeRule({ type: 'maintainer_collapse', throttleMinutes: 1440 })]
    await dedup.filterDuplicates([alert], rules)
    expect(redis.exists).toHaveBeenCalled()
  })

  it('filterDuplicates falls back to 60 min when no matching rule', async () => {
    const redis = makeMockRedis(0)
    const dedup = new AlertDeduplicator(redis)
    const alert = makeAlert({ type: 'bus_factor_one', deduplicationKey: 'bf:pkg-1' })
    const result = await dedup.filterDuplicates([alert], [])
    expect(result).toHaveLength(1)
  })
})
