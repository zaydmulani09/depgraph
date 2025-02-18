import type { NpmPackageMetadata } from './client'

export interface NormalizedNpmPackage {
  package: {
    ecosystem: 'npm'
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

function normalizeRepoUrl(repo: NpmPackageMetadata['repository']): string | null {
  if (!repo) return null
  let raw = typeof repo === 'string' ? repo : (repo.url ?? '')
  if (!raw) return null

  // Strip git+, git://, ssh://git@
  raw = raw
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '')

  // github:owner/repo shorthand
  if (raw.startsWith('github:')) {
    raw = `https://github.com/${raw.slice('github:'.length)}`
  }

  return raw || null
}

export function normalizeNpmPackage(meta: NpmPackageMetadata): NormalizedNpmPackage {
  const timeEntries = Object.entries(meta.time ?? {}).filter(
    ([k]) => k !== 'created' && k !== 'modified'
  )

  let firstPublishedAt: Date | null = null
  if (timeEntries.length > 0) {
    const sorted = timeEntries
      .map(([, v]) => new Date(v))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())
    firstPublishedAt = sorted[0] ?? null
  }

  const lastPublishedAt = meta.time?.modified ? new Date(meta.time.modified) : null

  const validVersionKeys = new Set(
    Object.keys(meta.versions ?? {}).filter((v) => meta.time?.[v] !== undefined)
  )

  const versions = Array.from(validVersionKeys).map((v) => {
    const vmeta = meta.versions[v]
    return {
      version: v,
      published_at: meta.time?.[v] ? new Date(meta.time[v]) : null,
      tarball_url: vmeta.dist?.tarball ?? null,
      license: vmeta.license ?? null,
      has_types: !!(vmeta.types || vmeta.typings),
      deprecated: !!vmeta.deprecated,
      deprecation_message: vmeta.deprecated ?? null,
    }
  })

  const dependencies: NormalizedNpmPackage['dependencies'] = []
  for (const v of validVersionKeys) {
    const vmeta = meta.versions[v]
    for (const [pkg, range] of Object.entries(vmeta.dependencies ?? {})) {
      dependencies.push({ from_version: v, to_package_name: pkg, version_range: range, is_dev: false, is_optional: false, is_peer: false })
    }
    for (const [pkg, range] of Object.entries(vmeta.devDependencies ?? {})) {
      dependencies.push({ from_version: v, to_package_name: pkg, version_range: range, is_dev: true, is_optional: false, is_peer: false })
    }
    for (const [pkg, range] of Object.entries(vmeta.peerDependencies ?? {})) {
      dependencies.push({ from_version: v, to_package_name: pkg, version_range: range, is_dev: false, is_optional: false, is_peer: true })
    }
    for (const [pkg, range] of Object.entries(vmeta.optionalDependencies ?? {})) {
      dependencies.push({ from_version: v, to_package_name: pkg, version_range: range, is_dev: false, is_optional: true, is_peer: false })
    }
  }

  // Collect unique maintainers from top-level + all version metadata
  const maintainerMap = new Map<string, { registry_username: string; email: string | null }>()
  const addMaintainers = (list?: Array<{ name: string; email?: string }>) => {
    for (const m of list ?? []) {
      if (!maintainerMap.has(m.name)) {
        maintainerMap.set(m.name, { registry_username: m.name, email: m.email ?? null })
      }
    }
  }
  addMaintainers(meta.maintainers)
  for (const v of validVersionKeys) {
    addMaintainers(meta.versions[v].maintainers)
  }

  return {
    package: {
      ecosystem: 'npm',
      name: meta.name,
      description: meta.description ?? null,
      homepage: meta.homepage ?? null,
      repository_url: normalizeRepoUrl(meta.repository),
      latest_version: meta['dist-tags']?.latest ?? null,
      first_published_at: firstPublishedAt,
      last_published_at: lastPublishedAt,
      weekly_downloads: 0, // populated by crawler worker after download fetch
    },
    versions,
    dependencies,
    maintainers: Array.from(maintainerMap.values()),
  }
}
