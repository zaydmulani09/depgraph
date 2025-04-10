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
import { normalizeCratePackage } from '../registries/cargo/normalizer'
import type { CrateMetadata, CrateDependency } from '../registries/cargo/client'
import { githubIngestQueue, osvIngestQueue, graphPopulateQueue } from '../queue'

const PREFIX = '[cargo-process]'

interface CargoProcessDeps {
  redis: Redis
  storage: RawStorage
  db: typeof DbType
}

export function createCargoProcessWorker(deps: CargoProcessDeps): Worker {
  const { redis, storage, db } = deps

  return new Worker(
    'cargo-process',
    async (job) => {
      const { crateName, storageKey } = job.data as {
        crateName: string
        storageKey: string
      }
      console.log(`${PREFIX} Processing ${crateName}`)

      const raw = await storage.load(storageKey)
      const { metadata, dependenciesByVersion: depsObj } = raw as {
        metadata: CrateMetadata
        dependenciesByVersion: Record<string, CrateDependency[]>
      }

      // Reconstruct Map from stored plain object
      const dependenciesByVersion = new Map<string, CrateDependency[]>(
        Object.entries(depsObj)
      )

      const normalized = normalizeCratePackage(metadata, dependenciesByVersion)

      let versionsWritten = 0
      let depsWritten = 0
      let maintainersWritten = 0
      let insertedPackageId: string | null = null

      await db.transaction(async (tx) => {
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

        const maintainerIdMap = new Map<string, string>()
        for (const m of normalized.maintainers) {
          const [row] = await tx
            .insert(maintainers)
            .values({ ...m, ecosystem: 'cargo' })
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

        for (const v of normalized.versions) {
          const versionId = versionIdMap.get(v.version)
          if (!versionId) continue
          for (const [, mId] of maintainerIdMap) {
            await tx
              .insert(maintainerVersions)
              .values({ maintainer_id: mId, version_id: versionId })
              .onConflictDoNothing()
          }
        }

        for (const dep of normalized.dependencies) {
          const fromVersionId = versionIdMap.get(dep.from_version)
          if (!fromVersionId) continue

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
        `${PREFIX} ${crateName}: ${versionsWritten} versions, ${depsWritten} deps, ${maintainersWritten} maintainers written`
      )

      if (normalized.package.repository_url) {
        await githubIngestQueue.add('ingest', {
          packageName: crateName,
          repositoryUrl: normalized.package.repository_url,
        })
        console.log(`${PREFIX} Enqueued github-ingest for ${crateName}`)
      }

      if (insertedPackageId) {
        await osvIngestQueue.add('ingest', {
          mode: 'package',
          packageName: crateName,
          ecosystem: 'crates.io',
          packageId: insertedPackageId,
        })
        console.log(`${PREFIX} Enqueued osv-ingest for ${crateName}`)

        await graphPopulateQueue.add('populate', { packageIds: [insertedPackageId] })
        console.log(`${PREFIX} Enqueued graph-populate for ${crateName}`)
      }

      return { crateName, versionsWritten, depsWritten, maintainersWritten }
    },
    { connection: redis }
  )
}
