import { parsePep440, comparePep440 } from '../registries/pypi/pep440'
import { parseVersion } from '../simulator/semver'
import type { Ecosystem } from './adapter'

export function normalizeVersion(version: string, ecosystem: Ecosystem): string {
  switch (ecosystem) {
    case 'npm':
    case 'cargo': {
      const stripped = version.replace(/^[vV]/, '')
      const parsed = parseVersion(stripped)
      if (!parsed) return '0.0.0'
      const base = `${parsed.major}.${parsed.minor}.${parsed.patch}`
      return parsed.prerelease ? `${base}-${parsed.prerelease}` : base
    }
    case 'pypi': {
      const parsed = parsePep440(version)
      if (!parsed) return '0.0.0'

      const r0 = parsed.release[0] ?? 0
      const r1 = parsed.release[1] ?? 0
      const r2 = parsed.release[2] ?? 0
      const major = parsed.epoch > 0 ? parsed.epoch * 10000 + r0 : r0
      const base = `${major}.${r1}.${r2}`

      const suffixes: string[] = []
      if (parsed.pre) {
        const typeMap = { a: 'alpha', b: 'beta', rc: 'rc' } as const
        suffixes.push(`${typeMap[parsed.pre.type]}.${parsed.pre.n}`)
      }
      if (parsed.dev !== null) {
        suffixes.push(`dev.${parsed.dev}`)
      }

      return suffixes.length > 0 ? `${base}-${suffixes.join('.')}` : base
    }
  }
}

export function isPreReleaseVersion(version: string, ecosystem: Ecosystem): boolean {
  switch (ecosystem) {
    case 'npm':
    case 'cargo':
      return version.replace(/^[vV]/, '').includes('-')
    case 'pypi': {
      const parsed = parsePep440(version)
      if (!parsed) return false
      return parsed.pre !== null || parsed.dev !== null
    }
  }
}

export function compareVersions(a: string, b: string, ecosystem: Ecosystem): number {
  if (ecosystem === 'pypi') {
    const pa = parsePep440(a)
    const pb = parsePep440(b)
    if (!pa && !pb) return 0
    if (!pa) return -1
    if (!pb) return 1
    return comparePep440(pa, pb)
  }

  // npm, cargo: semver
  const pa = parseVersion(a.replace(/^[vV]/, ''))
  const pb = parseVersion(b.replace(/^[vV]/, ''))
  if (!pa && !pb) return 0
  if (!pa) return -1
  if (!pb) return 1

  if (pa.major !== pb.major) return pa.major - pb.major
  if (pa.minor !== pb.minor) return pa.minor - pb.minor
  if (pa.patch !== pb.patch) return pa.patch - pb.patch

  // pre-release < release
  if (pa.prerelease && !pb.prerelease) return -1
  if (!pa.prerelease && pb.prerelease) return 1
  if (pa.prerelease && pb.prerelease) return pa.prerelease.localeCompare(pb.prerelease)

  return 0
}
