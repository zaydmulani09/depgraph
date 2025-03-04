import { describe, it, expect } from 'vitest'
import { scoreSecurityDimension } from './security'
import type { RiskInput } from '../types'

function makeInput(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    packageId: 'pkg-1',
    packageName: 'test-pkg',
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

describe('scoreSecurityDimension', () => {
  it('returns score 0 with no advisories', () => {
    const { score } = scoreSecurityDimension(makeInput())
    expect(score).toBe(0)
  })

  it('scores 1 critical advisory with no cvss at expected level', () => {
    const { score } = scoreSecurityDimension(
      makeInput({ advisories: [{ severity: 'critical', cvss_score: null, withdrawn_at: null }] })
    )
    // f1=60 (45%), f2=0 (30%), f3=20 (15%), f4=0 (10%)
    // 60*0.45 + 0*0.30 + 20*0.15 + 0*0.10 = 27 + 0 + 3 + 0 = 30
    expect(score).toBe(30)
  })

  it('scores 3 critical advisories at max critical bracket', () => {
    const { score } = scoreSecurityDimension(
      makeInput({
        advisories: [
          { severity: 'critical', cvss_score: null, withdrawn_at: null },
          { severity: 'critical', cvss_score: null, withdrawn_at: null },
          { severity: 'critical', cvss_score: null, withdrawn_at: null },
        ],
      })
    )
    // f1=100 (45%), f2=0 (30%), f3=50 (15%), f4=0 (10%)
    // 100*0.45 + 0 + 50*0.15 + 0 = 45 + 7.5 = 52.5
    expect(score).toBe(52.5)
  })

  it('ignores withdrawn advisories', () => {
    const { score } = scoreSecurityDimension(
      makeInput({
        advisories: [
          { severity: 'critical', cvss_score: 9.8, withdrawn_at: new Date() },
        ],
      })
    )
    expect(score).toBe(0)
  })

  it('accounts for cvss score in factor 4', () => {
    const { score } = scoreSecurityDimension(
      makeInput({
        advisories: [{ severity: 'high', cvss_score: 8.0, withdrawn_at: null }],
      })
    )
    // f1=0, f2=40 (1 high), f3=20 (1 total), f4=(8/10)*100=80
    // 0*0.45 + 40*0.30 + 20*0.15 + 80*0.10 = 0 + 12 + 3 + 8 = 23
    expect(score).toBe(23)
  })

  it('returns explanations with correct factor names', () => {
    const { explanations } = scoreSecurityDimension(makeInput())
    const names = explanations.map((e) => e.factor_name)
    expect(names).toContain('critical_advisories')
    expect(names).toContain('high_advisories')
    expect(names).toContain('total_advisories')
    expect(names).toContain('max_cvss')
  })

  it('contribution_pcts sum to 100', () => {
    const { explanations } = scoreSecurityDimension(makeInput())
    const total = explanations.reduce((s, e) => s + e.contribution_pct, 0)
    expect(total).toBe(100)
  })
})
