import type { OsvVulnerability } from './client'
import { parseSeverity, parseAffectedRanges } from './severity-parser'

export interface NormalizedAdvisory {
  advisory: {
    osv_id: string
    package_id: string
    title: string
    description: string | null
    severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown'
    cvss_score: number | null
    published_at: Date | null
    modified_at: Date | null
    withdrawn_at: Date | null
    aliases: string[]
  }
  affected_versions: Array<{
    version_range: string
    fixed_version: string | null
  }>
}

function safeDate(s: string | undefined | null): Date | null {
  if (!s) return null
  try {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

export function normalizeOsvAdvisory(
  osv: OsvVulnerability,
  packageId: string
): NormalizedAdvisory {
  const { severity, cvss_score } = parseSeverity(osv)

  // Find the package name from affected array for range parsing
  // Use the first affected entry's package name as the canonical name
  const packageName = osv.affected?.[0]?.package?.name ?? ''
  const affectedVersions = parseAffectedRanges(osv, packageName)

  const title = osv.summary ?? osv.id

  let description: string | null = osv.details ?? null
  if (description && description.length > 10000) {
    description = description.slice(0, 10000)
  }

  // Deduplicate aliases, exclude osv_id itself
  const rawAliases = osv.aliases ?? []
  const aliases = [...new Set(rawAliases)].filter((a) => a !== osv.id)

  return {
    advisory: {
      osv_id: osv.id,
      package_id: packageId,
      title,
      description,
      severity,
      cvss_score,
      published_at: safeDate(osv.published),
      modified_at: safeDate(osv.modified),
      withdrawn_at: safeDate(osv.withdrawn),
      aliases,
    },
    affected_versions: affectedVersions,
  }
}
