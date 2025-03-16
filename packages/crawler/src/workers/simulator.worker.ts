import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import { simulateUpgrade } from '../simulator/simulator'

const PREFIX = '[simulator]'

interface SimulateJobData {
  packageName: string
  ecosystem: string
  fromVersion: string
  toVersion: string
}

export function createSimulatorWorker(deps: { redis: Redis; db: any }): Worker {
  const { redis, db } = deps

  return new Worker(
    'simulate-upgrade',
    async (job) => {
      const { packageName, ecosystem, fromVersion, toVersion } = job.data as SimulateJobData

      try {
        const result = await simulateUpgrade(db, {
          packageName,
          ecosystem: ecosystem as 'npm' | 'pypi' | 'cargo',
          fromVersion,
          toVersion,
        })

        console.log(
          `${PREFIX} ${packageName} ${fromVersion}→${toVersion} | ` +
            `composite delta: ${result.compositeDelta > 0 ? '+' : ''}${result.compositeDelta} | ` +
            `breaking risk: ${result.breakingRisk}`
        )

        return result
      } catch (err) {
        console.error(`${PREFIX} ERROR simulating ${packageName} ${fromVersion}→${toVersion}:`, err)
        throw err
      }
    },
    { connection: redis }
  )
}
