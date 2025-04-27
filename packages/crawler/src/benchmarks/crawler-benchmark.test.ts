import { describe, it, expect, beforeEach } from 'vitest'
import { runCrawlerBenchmark } from './crawler-benchmark'
import type { CrawlDedup } from '../lib/dedup'
import type { RawStorage } from '../lib/storage'

function createMemoryDedup(): CrawlDedup {
  const seen = new Set<string>()
  return {
    isSeen: async (key: string) => seen.has(key),
    markSeen: async (key: string) => { seen.add(key) },
    clear: async () => { seen.clear() },
  } as unknown as CrawlDedup
}

const mockStorage = null as unknown as RawStorage

describe('runCrawlerBenchmark with useFixtures: true', () => {
  let dedup: CrawlDedup

  beforeEach(() => {
    dedup = createMemoryDedup()
  })

  it('reports packagesAttempted === 3 for 3 npm fixtures', async () => {
    const result = await runCrawlerBenchmark({
      ecosystem: 'npm',
      packages: ['react', 'lodash', 'express'],
      useFixtures: true,
      storage: mockStorage,
      dedup,
    })
    expect(result.packagesAttempted).toBe(3)
  })

  it('all 3 npm fixtures succeed on first run', async () => {
    const result = await runCrawlerBenchmark({
      ecosystem: 'npm',
      packages: ['react', 'lodash', 'express'],
      useFixtures: true,
      storage: mockStorage,
      dedup,
    })
    expect(result.packagesSucceeded).toBe(3)
    expect(result.packagesFailed).toBe(0)
  })

  it('second run has cacheHits === 3 (all seen from first run)', async () => {
    await runCrawlerBenchmark({
      ecosystem: 'npm',
      packages: ['react', 'lodash', 'express'],
      useFixtures: true,
      storage: mockStorage,
      dedup,
    })
    const secondRun = await runCrawlerBenchmark({
      ecosystem: 'npm',
      packages: ['react', 'lodash', 'express'],
      useFixtures: true,
      storage: mockStorage,
      dedup,
    })
    expect(secondRun.cacheHits).toBe(3)
  })

  it('packagesPerSecond > 0 for fixture mode', async () => {
    const result = await runCrawlerBenchmark({
      ecosystem: 'npm',
      packages: ['react', 'lodash', 'express'],
      useFixtures: true,
      storage: mockStorage,
      dedup,
    })
    expect(result.packagesPerSecond).toBeGreaterThan(0)
  })

  it('apiErrorRate === 0 when all fixtures exist', async () => {
    const result = await runCrawlerBenchmark({
      ecosystem: 'npm',
      packages: ['react', 'lodash', 'express'],
      useFixtures: true,
      storage: mockStorage,
      dedup,
    })
    expect(result.apiErrorRate).toBe(0)
  })

  it('missing fixture results in packagesFailed increment', async () => {
    const result = await runCrawlerBenchmark({
      ecosystem: 'npm',
      packages: ['no-such-package-xyz'],
      useFixtures: true,
      storage: mockStorage,
      dedup,
    })
    expect(result.packagesFailed).toBe(1)
    expect(result.errors.length).toBe(1)
    expect(result.errors[0].packageName).toBe('no-such-package-xyz')
  })
})
