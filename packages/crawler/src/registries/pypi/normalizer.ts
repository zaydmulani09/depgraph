import type { PypiPackageMetadata } from './client'
import { normalizePypiName } from './client'
import { parsePep440, isStableRelease } from './pep440'
import { parsePep508 } from './pep508'

export interface NormalizedPypiPackage {
  package: {
    ecosystem: 'pypi'
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

const REPO_URL_KEYS = ['source', 'source code', 'repository', 'code', 'github']

function extractRepositoryUrl(meta: PypiPackageMetadata['info']): string | null {
  if (meta.project_urls) {
    for (const [k, v] of Object.entries(meta.project_urls)) {
      if (REPO_URL_KEYS.includes(k.toLowerCase())) return v
    }
  }
  return meta.home_page ?? null
}

export function normalizePypiPackage(meta: PypiPackageMetadata): NormalizedPypiPackage {
  const name = normalizePypiName(meta.info.name)
  const repositoryUrl = extractRepositoryUrl(meta.info)

  const hasTypesFromClassifiers = meta.info.classifiers.some(
    (c) => c === 'Typing :: Typed' || c === 'Typing :: Stubs Only'
  )

  let firstPublishedAt: Date | null = null
  let lastPublishedAt: Date | null = null

  const versionsArr: NormalizedPypiPackage['versions'] = []

  for (const [versionStr, files] of Object.entries(meta.releases)) {
    if (!files || files.length === 0) continue

    const uploadTime = files[0].upload_time ? new Date(files[0].upload_time) : null

    if (uploadTime && (!firstPublishedAt || uploadTime < firstPublishedAt)) {
      firstPublishedAt = uploadTime
    }

    const sdistFile = files.find((f) => f.packagetype === 'sdist')
    const tarballUrl = sdistFile?.url ?? files[0]?.url ?? null

    const hasTypesFromStub = files.some((f) => f.filename.endsWith('.pyi'))

    versionsArr.push({
      version: versionStr,
      published_at: uploadTime,
      tarball_url: tarballUrl,
      license: meta.info.license,
      has_types: hasTypesFromClassifiers || hasTypesFromStub,
      deprecated: false,
      deprecation_message: null,
    })
  }

  // last_published_at: latest stable version's files
  const parsedLatest = meta.info.version ? parsePep440(meta.info.version) : null
  if (parsedLatest && isStableRelease(parsedLatest)) {
    const latestFiles = meta.releases[meta.info.version]
    if (latestFiles && latestFiles.length > 0 && latestFiles[0].upload_time) {
      lastPublishedAt = new Date(latestFiles[0].upload_time)
    }
  }

  // Dependencies from requires_dist — from_version = latest version only
  const dependencies: NormalizedPypiPackage['dependencies'] = []
  for (const spec of meta.info.requires_dist ?? []) {
    const parsed = parsePep508(spec)
    if (!parsed) continue
    dependencies.push({
      from_version: meta.info.version,
      to_package_name: parsed.name,
      version_range: parsed.versionSpec,
      is_dev: parsed.isDev,
      is_optional: parsed.isOptional,
      is_peer: false,
    })
  }

  // Maintainers from author/maintainer fields
  const maintainerMap = new Map<string, { registry_username: string; email: string | null }>()

  const addMaintainer = (personName: string | null, email: string | null) => {
    if (!personName && !email) return
    if (email) {
      const emails = email.split(',').map((e) => e.trim()).filter(Boolean)
      for (const e of emails) {
        const username = personName ?? e.split('@')[0]
        if (!maintainerMap.has(username)) {
          maintainerMap.set(username, { registry_username: username, email: e })
        }
      }
    } else if (personName) {
      if (!maintainerMap.has(personName)) {
        maintainerMap.set(personName, { registry_username: personName, email: null })
      }
    }
  }

  addMaintainer(meta.info.author, meta.info.author_email)
  addMaintainer(meta.info.maintainer, meta.info.maintainer_email)

  return {
    package: {
      ecosystem: 'pypi',
      name,
      description: meta.info.summary ?? null,
      homepage: meta.info.home_page ?? null,
      repository_url: repositoryUrl,
      latest_version: meta.info.version,
      first_published_at: firstPublishedAt,
      last_published_at: lastPublishedAt,
      weekly_downloads: 0,
    },
    versions: versionsArr,
    dependencies,
    maintainers: Array.from(maintainerMap.values()),
  }
}
