export type Ecosystem = 'npm' | 'pypi' | 'cargo'

export interface CanonicalPackage {
  ecosystem: Ecosystem
  name: string
  displayName: string
  description: string | null
  homepage: string | null
  repositoryUrl: string | null
  latestVersion: string | null
  firstPublishedAt: Date | null
  lastPublishedAt: Date | null
  weeklyDownloads: number
}

export interface CanonicalVersion {
  version: string
  normalizedVersion: string
  publishedAt: Date | null
  tarballUrl: string | null
  license: string | null
  hasTypes: boolean
  isDeprecated: boolean
  deprecationMessage: string | null
  isStable: boolean
  isPreRelease: boolean
}

export interface CanonicalDependency {
  fromVersion: string
  toPackageName: string
  toEcosystem: Ecosystem
  versionRange: string
  normalizedRange: string
  isDev: boolean
  isOptional: boolean
  isPeer: boolean
}

export interface CanonicalMaintainer {
  registryUsername: string
  email: string | null
  ecosystem: Ecosystem
}

export interface CanonicalPackageData {
  package: CanonicalPackage
  versions: CanonicalVersion[]
  dependencies: CanonicalDependency[]
  maintainers: CanonicalMaintainer[]
}

export interface ParsedEcosystemVersion {
  major: number | null
  minor: number | null
  patch: number | null
  preRelease: string | null
  raw: string
}

export interface NormalizedRange {
  raw: string
  lower: string | null
  lowerInclusive: boolean
  upper: string | null
  upperInclusive: boolean
  isWildcard: boolean
  canonical: string
}

export interface EcosystemAdapter {
  ecosystem: Ecosystem
  normalizeName(name: string): string
  parseVersion(version: string): ParsedEcosystemVersion | null
  parseVersionRange(range: string): NormalizedRange
  isStableVersion(version: string): boolean
  toCanonical(raw: unknown): CanonicalPackageData
}
