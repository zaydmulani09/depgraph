import { eq, sql, inArray } from 'drizzle-orm'
import type { db as DbType } from '@depgraph/db'
import { packages, versions, maintainers, maintainerVersions, dependencyEdges } from '@depgraph/db'
import { normalizeNpmPackage } from '../registries/npm/normalizer'
import { normalizePypiPackage } from '../registries/pypi/normalizer'
import { normalizeCratePackage } from '../registries/cargo/normalizer'
import type { NpmPackageMetadata } from '../registries/npm/client'
import type { PypiPackageMetadata } from '../registries/pypi/client'
import type { CrateMetadata, CrateDependency } from '../registries/cargo/client'
import { loadFixture, listFixtures, loadAllFixtures } from '../fixtures/loader'
import type { FixtureEcosystem } from '../fixtures/loader'

interface NormalizedPackage {
  package: {
    ecosystem: 'npm' | 'pypi' | 'cargo'
    name: string
    description: string | null
    homepage: string | null
    repository_url: string | null
    latest_version: string | null
    first_published_at: Date | null
    last_published_at: Date | null
    weekly_downloads: number
  }
  versions: Array<{
    version: string
    published_at: Date | null
    tarball_url: string | null
    license: string | null
    has_types: boolean
    deprecated: boolean
    deprecation_message: string | null
  }>
  dependencies: Array<{
    from_version: string
    to_package_name: string
    version_range: string
    is_dev: boolean
    is_optional: boolean
    is_peer: boolean
  }>
  maintainers: Array<{
    registry_username: string
    email: string | null
  }>
}

async function seedPackageToDb(
  normalized: NormalizedPackage,
  db: typeof DbType
): Promise<{ versionsWritten: number; depsWritten: number; maintainersWritten: number }> {
  let versionsWritten = 0
  let depsWritten = 0
  let maintainersWritten = 0

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
        .values({ ...m, ecosystem: normalized.package.ecosystem })
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

  return { versionsWritten, depsWritten, maintainersWritten }
}

export async function seedFromFixtures(
  db: typeof DbType,
  options?: {
    ecosystems?: FixtureEcosystem[]
    verbose?: boolean
  }
): Promise<{ packagesSeeded: number; versionsSeeded: number; depsSeeded: number }> {
  const ecosystems = options?.ecosystems ?? (['npm', 'pypi', 'cargo'] as FixtureEcosystem[])
  const verbose = options?.verbose ?? false

  let packagesSeeded = 0
  let versionsSeeded = 0
  let depsSeeded = 0

  for (const ecosystem of ecosystems) {
    const names = await listFixtures(ecosystem)

    if (ecosystem === 'npm') {
      for (const name of names) {
        const raw = await loadFixture('npm', name)
        if (!raw) continue
        const normalized = normalizeNpmPackage(raw as NpmPackageMetadata)
        const counts = await seedPackageToDb(normalized, db)
        packagesSeeded++
        versionsSeeded += counts.versionsWritten
        depsSeeded += counts.depsWritten
        if (verbose) {
          console.log(`[seed] npm/${name}: ${counts.versionsWritten}v ${counts.depsWritten}d ${counts.maintainersWritten}m`)
        }
      }
    }

    if (ecosystem === 'pypi') {
      for (const name of names) {
        const raw = await loadFixture('pypi', name)
        if (!raw) continue
        const normalized = normalizePypiPackage(raw as PypiPackageMetadata)
        const counts = await seedPackageToDb(normalized, db)
        packagesSeeded++
        versionsSeeded += counts.versionsWritten
        depsSeeded += counts.depsWritten
        if (verbose) {
          console.log(`[seed] pypi/${name}: ${counts.versionsWritten}v ${counts.depsWritten}d ${counts.maintainersWritten}m`)
        }
      }
    }

    if (ecosystem === 'cargo') {
      const crateNames = names.filter((n) => !n.endsWith('-deps'))
      for (const name of crateNames) {
        const raw = await loadFixture('cargo', name)
        if (!raw) continue
        const depsRaw = (await loadFixture('cargo', `${name}-deps`)) as {
          dependencies: CrateDependency[]
        } | null
        const deps = depsRaw?.dependencies ?? []
        const meta = raw as CrateMetadata
        const dependenciesByVersion = new Map<string, CrateDependency[]>([
          [meta.crate.max_version, deps],
        ])
        const normalized = normalizeCratePackage(meta, dependenciesByVersion)
        const counts = await seedPackageToDb(normalized, db)
        packagesSeeded++
        versionsSeeded += counts.versionsWritten
        depsSeeded += counts.depsWritten
        if (verbose) {
          console.log(`[seed] cargo/${name}: ${counts.versionsWritten}v ${counts.depsWritten}d ${counts.maintainersWritten}m`)
        }
      }
    }
  }

  return { packagesSeeded, versionsSeeded, depsSeeded }
}

export async function clearFixtureData(db: typeof DbType): Promise<void> {
  const all = await loadAllFixtures()
  const cargoNames = all.cargo.filter((n) => !n.endsWith('-deps'))
  const allNames = [...all.npm, ...all.pypi, ...cargoNames]

  if (allNames.length === 0) return

  await db.delete(packages).where(inArray(packages.name, allNames))
}
