import type { EcosystemAdapter, ParsedEcosystemVersion, NormalizedRange, CanonicalPackageData } from '../adapter'
import type { NormalizedCratePackage } from '../../registries/cargo/normalizer'
import { normalizeCrateName } from '../../registries/cargo/client'
import { normalizeVersion, isPreReleaseVersion } from '../version-normalizer'
import { normalizeRange } from '../range-normalizer'
import { parseVersion } from '../../simulator/semver'

export class CargoAdapter implements EcosystemAdapter {
  ecosystem = 'cargo' as const

  normalizeName(name: string): string {
    return normalizeCrateName(name)
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
    return normalizeRange(range, 'cargo')
  }

  isStableVersion(version: string): boolean {
    return !isPreReleaseVersion(version, 'cargo')
  }

  toCanonical(raw: NormalizedCratePackage): CanonicalPackageData {
    return {
      package: {
        ecosystem: 'cargo',
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
        normalizedVersion: normalizeVersion(v.version, 'cargo'),
        publishedAt: v.published_at,
        tarballUrl: v.tarball_url,
        license: v.license,
        hasTypes: v.has_types,
        isDeprecated: v.deprecated,
        deprecationMessage: v.deprecation_message,
        isStable: !isPreReleaseVersion(v.version, 'cargo'),
        isPreRelease: isPreReleaseVersion(v.version, 'cargo'),
      })),
      dependencies: raw.dependencies.map((d) => ({
        fromVersion: d.from_version,
        toPackageName: d.to_package_name,
        toEcosystem: 'cargo' as const,
        versionRange: d.version_range,
        normalizedRange: normalizeRange(d.version_range, 'cargo').canonical,
        isDev: d.is_dev,
        isOptional: d.is_optional,
        isPeer: d.is_peer,
      })),
      maintainers: raw.maintainers.map((m) => ({
        registryUsername: m.registry_username,
        email: m.email,
        ecosystem: 'cargo' as const,
      })),
    }
  }
}
