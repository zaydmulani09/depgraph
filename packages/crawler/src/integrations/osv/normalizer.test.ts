import { describe, it, expect } from 'vitest'
import { normalizeOsvAdvisory } from './normalizer'
import type { OsvVulnerability } from './client'

const PACKAGE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

function makeVuln(overrides: Partial<OsvVulnerability> = {}): OsvVulnerability {
  return {
    id: 'GHSA-test-0001',
    summary: 'Remote code execution in test-pkg',
    details: 'Detailed description of the vulnerability.',
    aliases: ['CVE-2024-12345', 'GHSA-test-0001'],
    severity: [{ type: 'CVSS_V3', score: '9.8' }],
    published: '2024-01-01T00:00:00Z',
    modified: '2024-01-15T00:00:00Z',
    affected: [
      {
        package: { ecosystem: 'npm', name: 'test-pkg' },
        ranges: [
          {
            type: 'SEMVER',
            events: [{ introduced: '1.0.0' }, { fixed: '1.2.3' }],
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe('normalizeOsvAdvisory', () => {
  it('uses summary as title when present', () => {
    const result = normalizeOsvAdvisory(makeVuln(), PACKAGE_ID)
    expect(result.advisory.title).toBe('Remote code execution in test-pkg')
  })

  it('falls back to osv_id when summary missing', () => {
    const result = normalizeOsvAdvisory(makeVuln({ summary: undefined }), PACKAGE_ID)
    expect(result.advisory.title).toBe('GHSA-test-0001')
  })

  it('truncates description at 10000 chars', () => {
    const long = 'x'.repeat(15000)
    const result = normalizeOsvAdvisory(makeVuln({ details: long }), PACKAGE_ID)
    expect(result.advisory.description?.length).toBe(10000)
  })

  it('does not truncate description under 10000 chars', () => {
    const result = normalizeOsvAdvisory(makeVuln(), PACKAGE_ID)
    expect(result.advisory.description).toBe('Detailed description of the vulnerability.')
  })

  it('aliases deduplicates and excludes osv_id itself', () => {
    const result = normalizeOsvAdvisory(
      makeVuln({ aliases: ['CVE-2024-12345', 'CVE-2024-12345', 'GHSA-test-0001'] }),
      PACKAGE_ID
    )
    // Should contain CVE but NOT the osv_id GHSA-test-0001
    expect(result.advisory.aliases).toContain('CVE-2024-12345')
    expect(result.advisory.aliases).not.toContain('GHSA-test-0001')
    // Deduplicated
    expect(result.advisory.aliases.filter((a) => a === 'CVE-2024-12345')).toHaveLength(1)
  })

  it('withdrawn_at is null when withdrawn field missing', () => {
    const result = normalizeOsvAdvisory(makeVuln(), PACKAGE_ID)
    expect(result.advisory.withdrawn_at).toBeNull()
  })

  it('withdrawn_at is parsed when present', () => {
    const result = normalizeOsvAdvisory(
      makeVuln({ withdrawn: '2024-02-01T00:00:00Z' }),
      PACKAGE_ID
    )
    expect(result.advisory.withdrawn_at).toBeInstanceOf(Date)
  })

  it('affected_versions populated from ranges', () => {
    const result = normalizeOsvAdvisory(makeVuln(), PACKAGE_ID)
    expect(result.affected_versions).toHaveLength(1)
    expect(result.affected_versions[0].version_range).toBe('>=1.0.0 <1.2.3')
    expect(result.affected_versions[0].fixed_version).toBe('1.2.3')
  })

  it('severity and cvss_score parsed correctly', () => {
    const result = normalizeOsvAdvisory(makeVuln(), PACKAGE_ID)
    expect(result.advisory.severity).toBe('critical')
    expect(result.advisory.cvss_score).toBe(9.8)
  })

  it('package_id set correctly', () => {
    const result = normalizeOsvAdvisory(makeVuln(), PACKAGE_ID)
    expect(result.advisory.package_id).toBe(PACKAGE_ID)
  })
})
