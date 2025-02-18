import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import type { RateLimiter } from '../lib/rate-limiter'
import type { CrawlDedup } from '../lib/dedup'
import type { RawStorage } from '../lib/storage'
import { NpmRegistryClient } from '../registries/npm/client'
import { npmProcessQueue } from '../queue'

const PREFIX = '[npm-crawl]'

interface NpmCrawlDeps {
  redis: Redis
  limiter: RateLimiter
  dedup: CrawlDedup
  storage: RawStorage
}

export function createNpmCrawlWorker(deps: NpmCrawlDeps): Worker {
  const { redis, limiter, dedup, storage } = deps
  const client = new NpmRegistryClient(limiter)

  return new Worker(
    'npm-crawl',
    async (job) => {
      const { packageName } = job.data as { packageName: string }
      const dedupKey = `npm:${packageName}`
      const storageKey = `npm/${packageName}/metadata.json`

      console.log(`${PREFIX} Processing ${packageName}`)

      // 1. Check dedup
      if (await dedup.isSeen(dedupKey)) {
        console.log(`${PREFIX} Skipping ${packageName} (already seen)`)
        return { skipped: true }
      }

      // 2. Check raw storage
      if (await storage.exists(storageKey)) {
        console.log(`${PREFIX} Skipping ${packageName} (already in storage)`)
        await dedup.markSeen(dedupKey)
        return { skipped: true }
      }

      // 3. Throttle
      console.log(`${PREFIX} Fetching ${packageName}...`)
      await limiter.throttle()

      // 4. Fetch metadata
      const metadata = await client.getPackageMetadata(packageName)
      console.log(`${PREFIX} Fetched ${packageName}: ${Object.keys(metadata.versions).length} versions`)

      // 5. Fetch downloads
      const downloads = await client.getPackageDownloads(packageName)
      console.log(`${PREFIX} Downloads for ${packageName}: ${downloads}/week`)

      // Attach downloads to metadata for normalizer
      ;(metadata as Record<string, unknown>)._weekly_downloads = downloads

      // 6. Save to MinIO
      await storage.save(storageKey, metadata)
      console.log(`${PREFIX} Saved ${packageName} to storage`)

      // 7. Mark seen
      await dedup.markSeen(dedupKey)

      // 8. Enqueue process job
      await npmProcessQueue.add('process', { packageName, storageKey })
      console.log(`${PREFIX} Enqueued process job for ${packageName}`)

      return {
        packageName,
        versions: Object.keys(metadata.versions).length,
      }
    },
    { connection: redis }
  )
}
