import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

export interface NpmCrawlJobData {
  packageName: string
  priority?: number
}

export interface NpmProcessJobData {
  packageName: string
  storageKey: string
}

export interface GitHubIngestJobData {
  packageName: string
  repositoryUrl: string
}

export interface OsvIngestJobData {
  mode: 'package' | 'sync'
  packageName?: string
  ecosystem: string
  packageId?: string
}

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 50,
}

export function createRedisConnection(): Redis {
  return new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  })
}

const redisConnection = createRedisConnection()

export const npmCrawlQueue = new Queue<NpmCrawlJobData>('npm-crawl', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
})

export const npmProcessQueue = new Queue<NpmProcessJobData>('npm-process', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
})

export const githubIngestQueue = new Queue<GitHubIngestJobData>('github-ingest', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
})

export const osvIngestQueue = new Queue<OsvIngestJobData>('osv-ingest', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
})

export interface RiskScoreJobData {
  packageId: string
}

export const riskScoreQueue = new Queue<RiskScoreJobData>('risk-score', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
})

export interface GraphPopulateJobData {
  packageIds?: string[]
  full?: boolean
}

export const graphPopulateQueue = new Queue<GraphPopulateJobData>('graph-populate', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
})

export const snapshotQueue = new Queue('snapshot', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
})

export const simulateUpgradeQueue = new Queue('simulate-upgrade', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
})

export interface AnalysisJobData {
  mode: 'package' | 'backfill' | 'bus-factor-scan'
  packageId?: string
  packageName?: string
}

export const runAnalysisQueue = new Queue<AnalysisJobData>('run-analysis', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
})

export interface PypiCrawlJobData {
  packageName: string
}

export interface PypiProcessJobData {
  packageName: string
  storageKey: string
}

export const pypiCrawlQueue = new Queue<PypiCrawlJobData>('pypi-crawl', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
})

export const pypiProcessQueue = new Queue<PypiProcessJobData>('pypi-process', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
})

export interface CargoCrawlJobData {
  crateName: string
}

export interface CargoProcessJobData {
  crateName: string
  storageKey: string
}

export const cargoCrawlQueue = new Queue<CargoCrawlJobData>('cargo-crawl', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
})

export const cargoProcessQueue = new Queue<CargoProcessJobData>('cargo-process', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
})
