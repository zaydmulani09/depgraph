import type { OsvVulnerability } from './client'

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'unknown'

function scoreToSeverity(score: number): Severity {
  if (score >= 9.0) return 'critical'
  if (score >= 7.0) return 'high'
  if (score >= 4.0) return 'medium'
  if (score >= 0.1) return 'low'
  return 'unknown'
}

function extractBaseScore(scoreStr: string): number | null {
  if (!scoreStr) return null

  // Plain numeric string (e.g. "7.5")
  const plain = parseFloat(scoreStr)
  if (!isNaN(plain) && !/[A-Z]/.test(scoreStr)) return plain

  // CVSS vector string — base score is embedded as e.g. CVSS:3.1/AV:N/.../
  // Many tools encode it as the numeric score at start: "9.8 CRITICAL" or just the vector
  // Try to find a numeric prefix before a space
  const prefixMatch = scoreStr.match(/^(\d+(?:\.\d+)?)/)
  if (prefixMatch) {
    const n = parseFloat(prefixMatch[1])
    if (!isNaN(n) && n >= 0 && n <= 10) return n
  }

  return null
}

export function parseSeverity(osv: OsvVulnerability): {
  severity: Severity
  cvss_score: number | null
} {
  try {
    if (!osv.severity || osv.severity.length === 0) {
      return { severity: 'unknown', cvss_score: null }
    }

    // Prefer CVSS_V3, fall back to CVSS_V2
    const v3 = osv.severity.find((s) => s.type === 'CVSS_V3')
    const v2 = osv.severity.find((s) => s.type === 'CVSS_V2')
    const entry = v3 ?? v2

    if (!entry) return { severity: 'unknown', cvss_score: null }

    const score = extractBaseScore(entry.score)
    if (score === null) return { severity: 'unknown', cvss_score: null }

    return { severity: scoreToSeverity(score), cvss_score: score }
  } catch {
    return { severity: 'unknown', cvss_score: null }
  }
}

export function parseAffectedRanges(
  osv: OsvVulnerability,
  packageName: string
): Array<{ version_range: string; fixed_version: string | null }> {
  try {
    // Find affected entry matching packageName (case-insensitive)
    const affected = osv.affected?.find(
      (a) => a.package.name.toLowerCase() === packageName.toLowerCase()
    )
    if (!affected) return []

    const results: Array<{ version_range: string; fixed_version: string | null }> = []

    if (affected.ranges && affected.ranges.length > 0) {
      for (const range of affected.ranges) {
        if (range.type !== 'SEMVER' && range.type !== 'ECOSYSTEM') continue

        // Collect introduced/fixed pairs from events
        let introduced: string | null = null
        let fixed: string | null = null

        for (const event of range.events) {
          if (event.introduced !== undefined) introduced = event.introduced
          if (event.fixed !== undefined) {
            fixed = event.fixed
            // Emit a range for this introduced→fixed pair
            let rangeStr: string
            if (introduced && introduced !== '0') {
              rangeStr = `>=${introduced} <${fixed}`
            } else {
              rangeStr = `<${fixed}`
            }
            results.push({ version_range: rangeStr, fixed_version: fixed })
            // Reset for next pair
            introduced = null
            fixed = null
          }
        }

        // Open-ended range (introduced but no fixed)
        if (introduced && introduced !== '0') {
          results.push({ version_range: `>=${introduced}`, fixed_version: null })
        }
      }
    }

    // Fall back to versions array
    if (results.length === 0 && affected.versions && affected.versions.length > 0) {
      results.push({
        version_range: `in:${affected.versions.join(',')}`,
        fixed_version: null,
      })
    }

    return results
  } catch {
    return []
  }
}
