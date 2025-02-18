import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import { eq, sql } from 'drizzle-orm'
import type { db as DbType } from '@depgraph/db'
import {
  packages,
  versions,
  maintainers,
  maintainerVersions,
  dependencyEdges,
} from '@depgraph/db'
import type { RawStorage } from '../lib/storage'
import { normalizeNpmPackage } from '../registries/npm/normalizer'
import type { NpmPackageMetadata } from '../registries/npm/client'
import { githubIngestQueue, osvIngestQueue, graphPopulateQueue } from '../queue'

const PREFIX = '[npm-process]'

interface NpmProcessDeps {
  redis: Redis
  storage: RawStorage
  db: typeof DbType
}

export function createNpmProcessWorker(deps: NpmProcessDeps): Worker {
  const { redis, storage, db } = deps

  return new Worker(
    'npm-process',
    async (job) => {
      const { packageName, storageKey } = job.data as {
        packageName: string
        storageKey: string
      }
      console.log(`${PREFIX} Processing ${packageName}`)

      // 1. Load raw metadata
      const raw = await storage.load(storageKey)
      const weeklyDownloads = (raw as Record<string, unknown>)._weekly_downloads as number ?? 0

      // 2. Normalize
      const normalized = normalizeNpmPackage(raw as NpmPackageMetadata)
      normalized.package.weekly_downloads = weeklyDownloads

      let versionsWritten = 0
      let depsWritten = 0
      let maintainersWritten = 0
      let insertedPackageId: string | null = null

      // 3. All writes in single transaction
      await db.transaction(async (tx) => {
        // Upsert package
        const [pkg] = await tx
          .insert(packages)
          .values(normalized.package)
          .onConflictDoUpdate({
            target: [packages.ecosystem, packages.name],
            set: {
              description: sql`excluded.description`,
              homepage: sql`excluded.homepage`,
              repository_url: sql`excluded.repository_url`,
              latest_version: sql`excluded.latest_version`,
              first_published_at: sql`excluded.first_published_at`,
              last_published_at: sql`excluded.last_published_at`,
              weekly_downloads: sql`excluded.weekly_downloads`,
              updated_at: sql`now()`,
            },
          })
          .returning({ id: packages.id })

        const packageId = pkg.id
        insertedPackageId = packageId

        // Upsert versions
        const versionIdMap = new Map<string, string>()
        for (const v of normalized.versions) {
          const [row] = await tx
            .insert(versions)
            .values({ ...v, package_id: packageId })
            .onConflictDoUpdate({
              target: [versions.package_id, versions.version],
              set: {
                published_at: sql`excluded.published_at`,
                tarball_url: sql`excluded.tarball_url`,
                license: sql`excluded.license`,
                has_types: sql`excluded.has_types`,
                deprecated: sql`excluded.deprecated`,
                deprecation_message: sql`excluded.deprecation_message`,
              },
            })
            .returning({ id: versions.id, version: versions.version })
          versionIdMap.set(row.version, row.id)
          versionsWritten++
        }

        // Upsert maintainers
        const maintainerIdMap = new Map<string, string>()
        for (const m of normalized.maintainers) {
          const [row] = await tx
            .insert(maintainers)
            .values({ ...m, ecosystem: 'npm' })
            .onConflictDoUpdate({
              target: [maintainers.ecosystem, maintainers.registry_username],
              set: {
                email: sql`excluded.email`,
                updated_at: sql`now()`,
              },
            })
            .returning({ id: maintainers.id, registry_username: maintainers.registry_username })
          maintainerIdMap.set(row.registry_username, row.id)
          maintainersWritten++
        }

        // Insert maintainer_versions join rows
        for (const v of normalized.versions) {
          const versionId = versionIdMap.get(v.version)
          if (!versionId) continue
          // Get maintainers from the version's raw data — use package-level maintainers as fallback
          for (const [, mId] of maintainerIdMap) {
            await tx
              .insert(maintainerVersions)
              .values({ maintainer_id: mId, version_id: versionId })
              .onConflictDoNothing()
          }
        }

        // Insert dependency edges
        for (const dep of normalized.dependencies) {
          const fromVersionId = versionIdMap.get(dep.from_version)
          if (!fromVersionId) continue

          // Look up or find to_package — skip if package not yet in DB
          const [toPkg] = await tx
            .select({ id: packages.id })
            .from(packages)
            .where(eq(packages.name, dep.to_package_name))
            .limit(1)
          if (!toPkg) continue

          await tx
            .insert(dependencyEdges)
            .values({
              from_version_id: fromVersionId,
              to_package_id: toPkg.id,
              version_range: dep.version_range,
              is_dev: dep.is_dev,
              is_optional: dep.is_optional,
              is_peer: dep.is_peer,
            })
            .onConflictDoNothing()
          depsWritten++
        }
      })

      console.log(
        `${PREFIX} ${packageName}: ${versionsWritten} versions, ${depsWritten} deps, ${maintainersWritten} maintainers written`
      )

      // Enqueue github-ingest if repository_url is available
      if (normalized.package.repository_url) {
        await githubIngestQueue.add('ingest', {
          packageName,
          repositoryUrl: normalized.package.repository_url,
        })
        console.log(`${PREFIX} Enqueued github-ingest for ${packageName}`)
      }

      // Enqueue osv-ingest for this package
      if (insertedPackageId) {
        await osvIngestQueue.add('ingest', {
          mode: 'package',
          packageName,
          ecosystem: 'npm',
          packageId: insertedPackageId,
        })
        console.log(`${PREFIX} Enqueued osv-ingest for ${packageName}`)

        await graphPopulateQueue.add('populate', { packageIds: [insertedPackageId] })
        console.log(`${PREFIX} Enqueued graph-populate for ${packageName}`)
      }

      return { packageName, versionsWritten, depsWritten, maintainersWritten }
    },
    { connection: redis }
  )
}
