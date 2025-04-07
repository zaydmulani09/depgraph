import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import type { RateLimiter } from '../lib/rate-limiter'
import type { CrawlDedup } from '../lib/dedup'
import type { RawStorage } from '../lib/storage'
import type { PypiRegistryClient } from '../registries/pypi/client'
import { normalizePypiName } from '../registries/pypi/client'
import { pypiProcessQueue } from '../queue'

const PREFIX = '[pypi-crawl]'

interface PypiCrawlDeps {
  redis: Redis
  limiter: RateLimiter
  dedup: CrawlDedup
  storage: RawStorage
  pypiClient: PypiRegistryClient
}

export function createPypiCrawlWorker(deps: PypiCrawlDeps): Worker {
  const { redis, dedup, storage, pypiClient } = deps

  return new Worker(
    'pypi-crawl',
    async (job) => {
      const { packageName } = job.data as { packageName: string }
      const normalizedName = normalizePypiName(packageName)
      const dedupKey = `pypi:${normalizedName}`
      const storageKey = `pypi/${normalizedName}/metadata.json`

      console.log(`${PREFIX} Processing ${normalizedName}`)

      if (await dedup.isSeen(dedupKey)) {
        console.log(`${PREFIX} Skipping ${normalizedName} (already seen)`)
        return { skipped: true }
      }

      if (await storage.exists(storageKey)) {
        console.log(`${PREFIX} Skipping ${normalizedName} (already in storage)`)
        await dedup.markSeen(dedupKey)
        return { skipped: true }
      }

      console.log(`${PREFIX} Fetching ${normalizedName}...`)
      const metadata = await pypiClient.getPackageMetadata(normalizedName)
      const versionsFound = Object.keys(metadata.releases).length
      console.log(`${PREFIX} Fetched ${normalizedName}: ${versionsFound} release entries`)

      await storage.save(storageKey, metadata)
      console.log(`${PREFIX} Saved ${normalizedName} to storage`)

      await dedup.markSeen(dedupKey)

      await pypiProcessQueue.add('process', { packageName: normalizedName, storageKey })
      console.log(`${PREFIX} Enqueued process job for ${normalizedName}`)

      return { packageName: normalizedName, versionsFound }
    },
    { connection: redis }
  )
}
