import type { EcosystemAdapter, ParsedEcosystemVersion, NormalizedRange, CanonicalPackageData } from '../adapter'
import type { NormalizedNpmPackage } from '../../registries/npm/normalizer'
import { normalizeVersion, isPreReleaseVersion } from '../version-normalizer'
import { normalizeRange } from '../range-normalizer'
import { parseVersion } from '../../simulator/semver'

export class NpmAdapter implements EcosystemAdapter {
  ecosystem = 'npm' as const

  normalizeName(name: string): string {
    return name.toLowerCase()
  }

  parseVersion(version: string): ParsedEcosystemVersion | null {
    const parsed = parseVersion(version.replace(/^[vV]/, ''))
    if (!parsed) return null
    return {
      major: parsed.major,
      minor: parsed.minor,
      patch: parsed.patch,
      preRelease: parsed.prerelease,
      raw: version,
    }
  }

  parseVersionRange(range: string): NormalizedRange {
    return normalizeRange(range, 'npm')
  }

  isStableVersion(version: string): boolean {
    return !isPreReleaseVersion(version, 'npm')
  }

  toCanonical(raw: NormalizedNpmPackage): CanonicalPackageData {
    return {
      package: {
        ecosystem: 'npm',
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
        normalizedVersion: normalizeVersion(v.version, 'npm'),
        publishedAt: v.published_at,
        tarballUrl: v.tarball_url,
        license: v.license,
        hasTypes: v.has_types,
        isDeprecated: v.deprecated,
        deprecationMessage: v.deprecation_message,
        isStable: !isPreReleaseVersion(v.version, 'npm'),
        isPreRelease: isPreReleaseVersion(v.version, 'npm'),
      })),
      dependencies: raw.dependencies.map((d) => ({
        fromVersion: d.from_version,
        toPackageName: d.to_package_name,
        toEcosystem: 'npm' as const,
        versionRange: d.version_range,
        normalizedRange: normalizeRange(d.version_range, 'npm').canonical,
        isDev: d.is_dev,
        isOptional: d.is_optional,
        isPeer: d.is_peer,
      })),
      maintainers: raw.maintainers.map((m) => ({
        registryUsername: m.registry_username,
        email: m.email,
        ecosystem: 'npm' as const,
      })),
    }
  }
}
