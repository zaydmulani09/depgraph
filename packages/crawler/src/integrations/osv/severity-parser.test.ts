import { describe, it, expect } from 'vitest'
import { parseSeverity, parseAffectedRanges } from './severity-parser'
import type { OsvVulnerability } from './client'

function makeVuln(overrides: Partial<OsvVulnerability> = {}): OsvVulnerability {
  return {
    id: 'GHSA-test-0001',
    published: '2024-01-01T00:00:00Z',
    modified: '2024-01-02T00:00:00Z',
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

describe('parseSeverity', () => {
  it('CVSS_V3 score 9.8 → critical', () => {
    const result = parseSeverity(
      makeVuln({ severity: [{ type: 'CVSS_V3', score: '9.8' }] })
    )
    expect(result.severity).toBe('critical')
    expect(result.cvss_score).toBe(9.8)
  })

  it('CVSS_V3 score 7.5 → high', () => {
    const result = parseSeverity(
      makeVuln({ severity: [{ type: 'CVSS_V3', score: '7.5' }] })
    )
    expect(result.severity).toBe('high')
    expect(result.cvss_score).toBe(7.5)
  })

  it('CVSS_V3 score 5.3 → medium', () => {
    const result = parseSeverity(
      makeVuln({ severity: [{ type: 'CVSS_V3', score: '5.3' }] })
    )
    expect(result.severity).toBe('medium')
    expect(result.cvss_score).toBe(5.3)
  })

  it('CVSS_V3 score 2.1 → low', () => {
    const result = parseSeverity(
      makeVuln({ severity: [{ type: 'CVSS_V3', score: '2.1' }] })
    )
    expect(result.severity).toBe('low')
    expect(result.cvss_score).toBe(2.1)
  })

  it('missing severity array → unknown, null score', () => {
    const result = parseSeverity(makeVuln({ severity: undefined }))
    expect(result.severity).toBe('unknown')
    expect(result.cvss_score).toBeNull()
  })

  it('empty severity array → unknown, null score', () => {
    const result = parseSeverity(makeVuln({ severity: [] }))
    expect(result.severity).toBe('unknown')
    expect(result.cvss_score).toBeNull()
  })

  it('malformed score string → unknown, does not throw', () => {
    const result = parseSeverity(
      makeVuln({ severity: [{ type: 'CVSS_V3', score: 'not-a-number' }] })
    )
    expect(result.severity).toBe('unknown')
    expect(result.cvss_score).toBeNull()
  })

  it('prefers CVSS_V3 over CVSS_V2', () => {
    const result = parseSeverity(
      makeVuln({
        severity: [
          { type: 'CVSS_V2', score: '5.0' },
          { type: 'CVSS_V3', score: '8.1' },
        ],
      })
    )
    expect(result.severity).toBe('high')
    expect(result.cvss_score).toBe(8.1)
  })
})

describe('parseAffectedRanges', () => {
  it('introduced + fixed → >=X <Y', () => {
    const vuln = makeVuln()
    const ranges = parseAffectedRanges(vuln, 'test-pkg')
    expect(ranges).toHaveLength(1)
    expect(ranges[0].version_range).toBe('>=1.0.0 <1.2.3')
    expect(ranges[0].fixed_version).toBe('1.2.3')
  })

  it('only introduced → >=X (no fixed)', () => {
    const vuln = makeVuln({
      affected: [
        {
          package: { ecosystem: 'npm', name: 'test-pkg' },
          ranges: [
            { type: 'SEMVER', events: [{ introduced: '2.0.0' }] },
          ],
        },
      ],
    })
    const ranges = parseAffectedRanges(vuln, 'test-pkg')
    expect(ranges).toHaveLength(1)
    expect(ranges[0].version_range).toBe('>=2.0.0')
    expect(ranges[0].fixed_version).toBeNull()
  })

  it('versions array → in:v1,v2,v3', () => {
    const vuln = makeVuln({
      affected: [
        {
          package: { ecosystem: 'npm', name: 'test-pkg' },
          versions: ['1.0.0', '1.0.1', '1.1.0'],
        },
      ],
    })
    const ranges = parseAffectedRanges(vuln, 'test-pkg')
    expect(ranges).toHaveLength(1)
    expect(ranges[0].version_range).toBe('in:1.0.0,1.0.1,1.1.0')
    expect(ranges[0].fixed_version).toBeNull()
  })

  it('no matching package name → []', () => {
    const vuln = makeVuln()
    const ranges = parseAffectedRanges(vuln, 'other-pkg')
    expect(ranges).toHaveLength(0)
  })

  it('case-insensitive package name match', () => {
    const vuln = makeVuln()
    const ranges = parseAffectedRanges(vuln, 'TEST-PKG')
    expect(ranges).toHaveLength(1)
  })

  it('introduced=0 omitted from range string', () => {
    const vuln = makeVuln({
      affected: [
        {
          package: { ecosystem: 'npm', name: 'test-pkg' },
          ranges: [
            { type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '1.0.5' }] },
          ],
        },
      ],
    })
    const ranges = parseAffectedRanges(vuln, 'test-pkg')
    expect(ranges[0].version_range).toBe('<1.0.5')
  })
})
