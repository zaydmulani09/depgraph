import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import type { RateLimiter } from '../lib/rate-limiter'
import type { CrawlDedup } from '../lib/dedup'
import type { RawStorage } from '../lib/storage'
import type { CratesIoClient } from '../registries/cargo/client'
import { cargoProcessQueue } from '../queue'

const PREFIX = '[cargo-crawl]'

interface CargoCrawlDeps {
  redis: Redis
  limiter: RateLimiter
  dedup: CrawlDedup
  storage: RawStorage
  cratesClient: CratesIoClient
}

export function createCargoCrawlWorker(deps: CargoCrawlDeps): Worker {
  const { redis, dedup, storage, cratesClient } = deps

  return new Worker(
    'cargo-crawl',
    async (job) => {
      const { crateName } = job.data as { crateName: string }
      const dedupKey = `cargo:${crateName}`
      const storageKey = `cargo/${crateName}/metadata.json`

      console.log(`${PREFIX} Processing ${crateName}`)

      if (await dedup.isSeen(dedupKey)) {
        console.log(`${PREFIX} Skipping ${crateName} (already seen)`)
        return { skipped: true }
      }

      if (await storage.exists(storageKey)) {
        console.log(`${PREFIX} Skipping ${crateName} (already in storage)`)
        await dedup.markSeen(dedupKey)
        return { skipped: true }
      }

      console.log(`${PREFIX} Fetching ${crateName}...`)
      const metadata = await cratesClient.getCrate(crateName)
      const versionsFound = metadata.versions.length
      console.log(`${PREFIX} Fetched ${crateName}: ${versionsFound} versions`)

      // Fetch deps for latest 5 non-yanked versions to avoid rate limit storm
      const top5 = metadata.versions
        .filter((v) => !v.yanked)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)

      const dependenciesByVersion: Record<string, unknown[]> = {}
      for (const v of top5) {
        try {
          const deps = await cratesClient.getCrateDependencies(crateName, v.num)
          dependenciesByVersion[v.num] = deps
        } catch (err) {
          console.warn(`${PREFIX} Failed to fetch deps for ${crateName}@${v.num}: ${err}`)
          dependenciesByVersion[v.num] = []
        }
      }

      const payload = { metadata, dependenciesByVersion }
      await storage.save(storageKey, payload)
      console.log(`${PREFIX} Saved ${crateName} to storage`)

      await dedup.markSeen(dedupKey)

      await cargoProcessQueue.add('process', { crateName, storageKey })
      console.log(`${PREFIX} Enqueued process job for ${crateName}`)

      return { crateName, versionsFound }
    },
    { connection: redis }
  )
}
