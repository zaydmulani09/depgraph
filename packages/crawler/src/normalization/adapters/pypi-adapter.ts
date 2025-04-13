import type { EcosystemAdapter, ParsedEcosystemVersion, NormalizedRange, CanonicalPackageData } from '../adapter'
import type { NormalizedPypiPackage } from '../../registries/pypi/normalizer'
import { normalizePypiName } from '../../registries/pypi/client'
import { parsePep440, isStableRelease } from '../../registries/pypi/pep440'
import { normalizeVersion, isPreReleaseVersion } from '../version-normalizer'
import { normalizeRange } from '../range-normalizer'

export class PypiAdapter implements EcosystemAdapter {
  ecosystem = 'pypi' as const

  normalizeName(name: string): string {
    return normalizePypiName(name)
  }

  parseVersion(version: string): ParsedEcosystemVersion | null {
    const parsed = parsePep440(version)
    if (!parsed) return null
    return {
      major: parsed.release[0] ?? null,
      minor: parsed.release[1] ?? null,
      patch: parsed.release[2] ?? null,
      preRelease: parsed.pre ? `${parsed.pre.type}${parsed.pre.n}` : null,
      raw: version,
    }
  }

  parseVersionRange(range: string): NormalizedRange {
    return normalizeRange(range, 'pypi')
  }

  isStableVersion(version: string): boolean {
    const parsed = parsePep440(version)
    if (!parsed) return false
    return isStableRelease(parsed)
  }

  toCanonical(raw: NormalizedPypiPackage): CanonicalPackageData {
    return {
      package: {
        ecosystem: 'pypi',
        name: this.normalizeName(raw.package.name),
        displayName: raw.package.name,
        description: raw.package.description,
        homepage: raw.package.homepage,
        repositoryUrl: raw.package.repository_url,
        latestVersion: raw.package.latest_version,
        firstPublishedAt: raw.package.first_published_at,
        lastPublishedAt: raw.package.last_published_at,
        weeklyDownloads: raw.package.weekly_downloads,
      },
      versions: raw.versions.map((v) => ({
        version: v.version,
        normalizedVersion: normalizeVersion(v.version, 'pypi'),
        publishedAt: v.published_at,
        tarballUrl: v.tarball_url,
        license: v.license,
        hasTypes: v.has_types,
        isDeprecated: v.deprecated,
        deprecationMessage: v.deprecation_message,
        isStable: !isPreReleaseVersion(v.version, 'pypi'),
        isPreRelease: isPreReleaseVersion(v.version, 'pypi'),
      })),
      dependencies: raw.dependencies.map((d) => ({
        fromVersion: d.from_version,
        toPackageName: d.to_package_name,
        toEcosystem: 'pypi' as const,
        versionRange: d.version_range,
        normalizedRange: normalizeRange(d.version_range, 'pypi').canonical,
        isDev: d.is_dev,
        isOptional: d.is_optional,
        isPeer: d.is_peer,
      })),
      maintainers: raw.maintainers.map((m) => ({
        registryUsername: m.registry_username,
        email: m.email,
        ecosystem: 'pypi' as const,
      })),
    }
  }
}
