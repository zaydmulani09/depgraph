import type { RawStorage } from '../lib/storage'
import type { CrawlDedup } from '../lib/dedup'
import { loadFixture } from '../fixtures/loader'

export interface CrawlerBenchmarkResult {
  ecosystem: string
  packagesAttempted: number
  packagesSucceeded: number
  packagesFailed: number
  cacheHits: number
  cacheMisses: number
  cacheHitRate: number
  totalDurationMs: number
  avgDurationPerPackageMs: number
  packagesPerSecond: number
  apiErrorRate: number
  errors: Array<{ packageName: string; error: string }>
}

export async function runCrawlerBenchmark(options: {
  ecosystem: 'npm' | 'pypi' | 'cargo'
  packages: string[]
  useFixtures?: boolean
  storage: RawStorage
  dedup: CrawlDedup
}): Promise<CrawlerBenchmarkResult> {
  const { ecosystem, packages: packageList, useFixtures = false, dedup } = options

  const errors: Array<{ packageName: string; error: string }> = []
  let packagesSucceeded = 0
  let packagesFailed = 0
  let cacheHits = 0
  let cacheMisses = 0

  const start = Date.now()

  for (const packageName of packageList) {
    const seen = await dedup.isSeen(`${ecosystem}:${packageName}`)

    if (seen) {
      cacheHits++
      packagesSucceeded++
      continue
    }

    cacheMisses++

    if (useFixtures) {
      // Fixture mode: load from local file instead of hitting the network
      const fixture = await loadFixture(ecosystem, packageName)
      if (!fixture) {
        packagesFailed++
        errors.push({ packageName, error: `No fixture found for ${ecosystem}/${packageName}` })
        continue
      }
      packagesSucceeded++
      await dedup.markSeen(`${ecosystem}:${packageName}`)
    } else {
      // Network mode: would call real registry clients here
      // Requires network access — not implemented in benchmark scope
      packagesFailed++
      errors.push({ packageName, error: 'Network mode not implemented in benchmark' })
    }
  }

  const totalDurationMs = Date.now() - start
  const packagesAttempted = packageList.length
  const avgDurationPerPackageMs =
    packagesAttempted > 0 ? totalDurationMs / packagesAttempted : 0
  const packagesPerSecond =
    totalDurationMs > 0 ? (packagesAttempted / totalDurationMs) * 1000 : packagesAttempted
  const cacheHitRate = packagesAttempted > 0 ? cacheHits / packagesAttempted : 0
  const apiErrorRate = packagesAttempted > 0 ? packagesFailed / packagesAttempted : 0

  return {
    ecosystem,
    packagesAttempted,
    packagesSucceeded,
    packagesFailed,
    cacheHits,
    cacheMisses,
    cacheHitRate,
    totalDurationMs,
    avgDurationPerPackageMs,
    packagesPerSecond,
    apiErrorRate,
    errors,
  }
}
