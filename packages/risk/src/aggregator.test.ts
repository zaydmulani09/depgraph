import { describe, it, expect } from 'vitest'
import { aggregateRiskScore } from './aggregator'
import type { RiskInput } from './types'

function makeInput(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    packageId: 'pkg-agg',
    packageName: 'agg-test',
    ecosystem: 'npm',
    signals: {},
    advisories: [],
    dependentCount: 0,
    transitiveDepth: 0,
    maintainerCount: 1,
    versionsCount: 5,
    ...overrides,
  }
}

describe('aggregateRiskScore', () => {
  it('returns a result with all 6 dimensions', () => {
    const result = aggregateRiskScore(makeInput())
    expect(result.security).toBeDefined()
    expect(result.maintenance).toBeDefined()
    expect(result.compatibility).toBeDefined()
    expect(result.concentration).toBeDefined()
    expect(result.blast_radius).toBeDefined()
    expect(result.operational).toBeDefined()
  })

  it('composite is rounded to 1 decimal place', () => {
    const result = aggregateRiskScore(makeInput())
    const str = result.composite.toString()
    const decimals = str.includes('.') ? str.split('.')[1].length : 0
    expect(decimals).toBeLessThanOrEqual(1)
  })

  it('composite is 0 for a perfectly healthy low-risk package', () => {
    const result = aggregateRiskScore(
      makeInput({
        signals: {
          days_since_last_commit: 10,
          days_since_last_release: 30,
          active_maintainer_count: 5,
          bus_factor: 4,                  // concentration: ≥4 → f1=0
          commit_frequency_30d: 25,
          issue_response_latency_days: 0.5,
          pr_merge_latency_days: 1,
          semver_violation_rate: 0,
          release_cadence_days: 60,
        },
        advisories: [],
        dependentCount: 0,
        transitiveDepth: 0,
        versionsCount: 20,
      })
    )
    expect(result.composite).toBe(0)
  })

  it('composite is between 0 and 100 for any input', () => {
    const high = aggregateRiskScore(
      makeInput({
        advisories: [
          { severity: 'critical', cvss_score: 10, withdrawn_at: null },
          { severity: 'critical', cvss_score: 9.8, withdrawn_at: null },
          { severity: 'critical', cvss_score: 9.5, withdrawn_at: null },
        ],
        dependentCount: 100000,
        transitiveDepth: 5,
        signals: { bus_factor: 1, active_maintainer_count: 1 },
      })
    )
    expect(high.composite).toBeGreaterThanOrEqual(0)
    expect(high.composite).toBeLessThanOrEqual(100)
  })

  it('flattened explanations scale contribution_pct by dimension weight', () => {
    const result = aggregateRiskScore(makeInput())
    // security factor contribution_pct within dim sums to 100,
    // so flattened should sum to ~100 (30+25+20+10+10+5) = 100
    const total = result.explanations.reduce((s, e) => s + e.contribution_pct, 0)
    expect(total).toBeCloseTo(100, 0)
  })

  it('packageId is propagated into result', () => {
    const result = aggregateRiskScore(makeInput({ packageId: 'abc-123' }))
    expect(result.packageId).toBe('abc-123')
  })
})
