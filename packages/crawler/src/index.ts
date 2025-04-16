import { Redis } from 'ioredis'
import { RateLimiter } from './lib/rate-limiter'
import { CrawlDedup } from './lib/dedup'
import { RawStorage } from './lib/storage'
import { createRedisConnection, npmCrawlQueue, graphPopulateQueue, snapshotQueue } from './queue'
import { createNpmCrawlWorker } from './workers/npm-crawl.worker'
import { createNpmProcessWorker } from './workers/npm-process.worker'
import { createGitHubIngestWorker } from './workers/github-ingest.worker'
import { createOsvIngestWorker } from './workers/osv-ingest.worker'
import { createGraphPopulateWorker } from './workers/graph-populate.worker'
import { createSnapshotWorker } from './workers/snapshot.worker'
import { startSnapshotScheduler } from './snapshots/scheduler'
import { seedBuiltinRules } from './policy/seeder'
import { createSimulatorWorker } from './workers/simulator.worker'
import { createAnalysisWorker } from './workers/analysis.worker'
import { runAnalysisQueue, pypiCrawlQueue, cargoCrawlQueue } from './queue'
import { GitHubClient } from './integrations/github/client'
import { OsvClient } from './integrations/osv/client'
import { OsvSyncCursor } from './integrations/osv/cursor'
import { osvIngestQueue } from './queue'
import { db } from '@depgraph/db'
import { isSqliteMode } from './benchmarks/sqlite-mode'
import { seedFromFixtures } from './benchmarks/offline-seed'
import type { AlertConfig } from './alerting/types'
import { DEFAULT_ALERT_RULES } from './alerting/types'
import { PypiRegistryClient } from './registries/pypi/client'
import { createPypiCrawlWorker } from './workers/pypi-crawl.worker'
import { createPypiProcessWorker } from './workers/pypi-process.worker'
import { CratesIoClient } from './registries/cargo/client'
import { createCargoCrawlWorker } from './workers/cargo-crawl.worker'
import { createCargoProcessWorker } from './workers/cargo-process.worker'

async function main() {
  console.log('[depgraph] Starting crawler...')

  if (isSqliteMode()) {
    console.log('[depgraph] SQLite mode detected — using local DB')
    console.log('[depgraph] Note: run db:migrate first to create schema in your SQLite file')
  }

  if (process.argv.includes('--seed-fixtures')) {
    await seedFromFixtures(db, { verbose: true })
    console.log('[depgraph] Fixture seeding complete.')
    process.exit(0)
  }

  const redis = createRedisConnection()
  const limiter = new RateLimiter({ requestsPerSecond: 10 })
  const dedup = new CrawlDedup(redis)
  const storage = new RawStorage({
    endpoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: Number(process.env.MINIO_PORT ?? 9000),
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'depgraph',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'depgraph123',
    bucket: process.env.MINIO_BUCKET ?? 'depgraph-raw',
  })

  const github = new GitHubClient({
    token: process.env.GITHUB_TOKEN,
    limiter,
  })

  const osv = new OsvClient(limiter)
  const cursor = new OsvSyncCursor(redis)

  const { seeded: rulesSeeded } = await seedBuiltinRules(db)
  console.log(`[depgraph] Seeded ${rulesSeeded} built-in policy rules`)

  const alertConfig: AlertConfig = {
    rules: DEFAULT_ALERT_RULES,
    ...(process.env.ALERT_WEBHOOK_URL
      ? {
          webhook: {
            url: process.env.ALERT_WEBHOOK_URL,
            secret: process.env.ALERT_WEBHOOK_SECRET,
            timeoutMs: process.env.ALERT_WEBHOOK_TIMEOUT_MS
              ? Number(process.env.ALERT_WEBHOOK_TIMEOUT_MS)
              : undefined,
          },
        }
      : {}),
    ...(process.env.ALERT_SMTP_HOST
      ? {
          email: {
            smtpHost: process.env.ALERT_SMTP_HOST,
            smtpPort: Number(process.env.ALERT_SMTP_PORT ?? 587),
            smtpUser: process.env.ALERT_SMTP_USER ?? '',
            smtpPass: process.env.ALERT_SMTP_PASS ?? '',
            from: process.env.ALERT_FROM_EMAIL ?? 'depgraph@localhost',
            to: (process.env.ALERT_TO_EMAILS ?? '').split(',').filter(Boolean),
          },
        }
      : {}),
  }

  const pypiClient = new PypiRegistryClient(limiter)
  const cargoLimiter = new RateLimiter({ requestsPerSecond: 1 })
  const cratesClient = new CratesIoClient({ limiter: cargoLimiter })

  const crawlWorker = createNpmCrawlWorker({ redis, limiter, dedup, storage })
  const processWorker = createNpmProcessWorker({ redis, storage, db })
  const githubWorker = createGitHubIngestWorker({ redis, github, db, limiter })
  const osvWorker = createOsvIngestWorker({ redis, osv, cursor, db })
  const graphWorker = createGraphPopulateWorker({ redis, db })
  const snapshotWorker = createSnapshotWorker({ redis, db, alertConfig })
  const scheduler = startSnapshotScheduler(snapshotQueue)
  const simulatorWorker = createSimulatorWorker({ redis, db })
  const analysisWorker = createAnalysisWorker({ redis, db })
  const pypiCrawlWorker = createPypiCrawlWorker({ redis, limiter, dedup, storage, pypiClient })
  const pypiProcessWorker = createPypiProcessWorker({ redis, storage, db })
  const cargoCrawlWorker = createCargoCrawlWorker({ redis, limiter: cargoLimiter, dedup, storage, cratesClient })
  const cargoProcessWorker = createCargoProcessWorker({ redis, storage, db })

  console.log('[depgraph] Workers started (npm-crawl, npm-process, pypi-crawl, pypi-process, cargo-crawl, cargo-process, github-ingest, osv-ingest, graph-populate, snapshot, simulator, analysis). Seeding initial packages...')

  // Seed a small set of well-known packages to start the crawl
  const seedPackages = [
    'react', 'lodash', 'express', 'axios', 'typescript',
    'next', 'vite', 'vitest', 'zod', 'drizzle-orm',
  ]

  for (const pkg of seedPackages) {
    await npmCrawlQueue.add('crawl', { packageName: pkg }, { priority: 1 })
  }

  console.log(`[depgraph] Seeded ${seedPackages.length} npm packages into crawl queue`)

  const seedPypiPackages = [
    'requests', 'numpy', 'django', 'flask', 'fastapi',
    'pandas', 'pytest', 'pydantic', 'sqlalchemy', 'httpx',
  ]
  for (const pkg of seedPypiPackages) {
    await pypiCrawlQueue.add('crawl', { packageName: pkg }, { priority: 1 })
  }
  console.log(`[depgraph] Seeded ${seedPypiPackages.length} PyPI packages into crawl queue`)

  const seedCrates = [
    'serde', 'tokio', 'rand', 'clap', 'anyhow',
    'reqwest', 'log', 'futures', 'axum', 'tracing',
  ]
  for (const crate of seedCrates) {
    await cargoCrawlQueue.add('crawl', { crateName: crate }, { priority: 1 })
  }
  console.log(`[depgraph] Seeded ${seedCrates.length} Cargo crates into crawl queue`)

  // Seed OSV sync jobs for all ecosystems
  const osvEcosystems = ['npm', 'PyPI', 'crates.io'] as const
  for (const ecosystem of osvEcosystems) {
    await osvIngestQueue.add('sync', { mode: 'sync', ecosystem })
  }
  console.log('[depgraph] Seeded OSV sync jobs for npm, PyPI, crates.io')

  // Enqueue full graph population to materialize consumer_edges from scratch
  await graphPopulateQueue.add('populate', { full: true })
  console.log('[depgraph] Seeded graph-populate full recompute job')

  // Seed initial baseline snapshot
  await snapshotQueue.add('snapshot', { mode: 'full' })
  console.log('[depgraph] Seeded initial baseline snapshot job')

  // Seed initial analysis jobs
  await runAnalysisQueue.add('backfill', { mode: 'backfill' })
  await runAnalysisQueue.add('bus-factor-scan', { mode: 'bus-factor-scan' })
  console.log('[depgraph] Seeded backfill + bus-factor-scan analysis jobs')

  process.on('SIGTERM', async () => {
    scheduler.stop()
    await crawlWorker.close()
    await processWorker.close()
    await pypiCrawlWorker.close()
    await pypiProcessWorker.close()
    await cargoCrawlWorker.close()
    await cargoProcessWorker.close()
    await githubWorker.close()
    await osvWorker.close()
    await graphWorker.close()
    await snapshotWorker.close()
    await simulatorWorker.close()
    await analysisWorker.close()
    process.exit(0)
  })
}

main().catch(console.error)
