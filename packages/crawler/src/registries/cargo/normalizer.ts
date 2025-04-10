import type { CrateMetadata, CrateDependency } from './client'

export interface NormalizedCratePackage {
  package: {
    ecosystem: 'cargo'
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

export function normalizeCratePackage(
  metadata: CrateMetadata,
  dependenciesByVersion: Map<string, CrateDependency[]>
): NormalizedCratePackage {
  const { crate, versions } = metadata

  const allDates = versions
    .map((v) => new Date(v.created_at))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())

  const firstPublishedAt = allDates[0] ?? null

  const nonYanked = versions.filter((v) => !v.yanked)
  const lastUpdated = nonYanked
    .map((v) => new Date(v.updated_at))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())

  const lastPublishedAt = lastUpdated[0] ?? null

  const normalizedVersions = nonYanked.map((v) => ({
    version: v.num,
    published_at: v.created_at ? new Date(v.created_at) : null,
    tarball_url: `https://crates.io${v.dl_path}`,
    license: v.license,
    has_types: false,
    deprecated: false,
    deprecation_message: null,
  }))

  const dependencies: NormalizedCratePackage['dependencies'] = []
  for (const [versionStr, deps] of dependenciesByVersion) {
    for (const dep of deps) {
      if (dep.kind === 'build') continue
      dependencies.push({
        from_version: versionStr,
        to_package_name: dep.crate_id,
        version_range: dep.req,
        is_dev: dep.kind === 'dev',
        is_optional: dep.optional,
        is_peer: false,
      })
    }
  }

  const maintainerMap = new Map<string, { registry_username: string; email: string | null }>()
  for (const v of versions) {
    if (v.published_by) {
      const { login, email } = v.published_by
      if (!maintainerMap.has(login)) {
        maintainerMap.set(login, { registry_username: login, email: email ?? null })
      }
    }
  }

  return {
    package: {
      ecosystem: 'cargo',
      name: crate.name,
      description: crate.description,
      homepage: crate.homepage,
      repository_url: crate.repository ? crate.repository.replace(/\.git$/, '') : null,
      latest_version: crate.max_version,
      first_published_at: firstPublishedAt,
      last_published_at: lastPublishedAt,
      weekly_downloads: crate.recent_downloads,
    },
    versions: normalizedVersions,
    dependencies,
    maintainers: Array.from(maintainerMap.values()),
  }
}
