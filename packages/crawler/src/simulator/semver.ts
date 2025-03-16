import type { SemverCompatibility, BreakingRisk } from './types'

export interface ParsedVersion {
  major: number
  minor: number
  patch: number
  prerelease: string | null
  raw: string
}

export function parseVersion(version: string): ParsedVersion | null {
  if (!version || typeof version !== 'string') return null

  // Strip leading v/V
  const stripped = version.replace(/^[vV]/, '')

  // Reject ranges and special strings
  if (/[^0-9.\-a-zA-Z+]/.test(stripped) || stripped === '*' || stripped === 'latest') return null
  if (/^[<>=^~]/.test(stripped)) return null

  const [corePart, ...prereleaseParts] = stripped.split('-')
  const prerelease = prereleaseParts.length > 0 ? prereleaseParts.join('-') : null

  const parts = corePart.split('.')
  if (parts.length !== 3) return null

  const [major, minor, patch] = parts.map(Number)
  if (!Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)) return null
  if (isNaN(major) || isNaN(minor) || isNaN(patch)) return null

  return { major, minor, patch, prerelease, raw: version }
}

export function classifyUpgrade(from: string, to: string): SemverCompatibility {
  const f = parseVersion(from)
  const t = parseVersion(to)

  if (!f || !t) return 'unknown'
  if (f.prerelease !== null || t.prerelease !== null) return 'unknown'

  if (t.major > f.major) return 'major'
  if (t.major < f.major) return 'major'           // downgrade → conservative

  if (t.minor > f.minor) return 'minor'
  if (t.minor < f.minor) return 'major'           // minor downgrade → conservative

  if (t.patch >= f.patch) return 'patch'
  return 'major'                                  // patch downgrade → conservative
}

export function assessBreakingRisk(
  compatibility: SemverCompatibility,
  fromScore: number,
  toScore: number
): BreakingRisk {
  const delta = Math.abs(toScore - fromScore)

  switch (compatibility) {
    case 'patch':
      return 'none'

    case 'minor':
      return delta > 10 ? 'medium' : 'low'

    case 'major':
      if (delta > 20) return 'high'
      if (delta > 5)  return 'medium'
      return 'low'

    case 'unknown':
    default:
      return 'medium'
  }
}
