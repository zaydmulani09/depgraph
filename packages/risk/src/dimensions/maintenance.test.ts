import { describe, it, expect } from 'vitest'
import { scoreMaintenanceDimension } from './maintenance'
import type { RiskInput } from '../types'

function makeInput(signals: Record<string, number> = {}): RiskInput {
  return {
    packageId: 'pkg-1',
    packageName: 'test-pkg',
    ecosystem: 'npm',
    signals,
    advisories: [],
    dependentCount: 0,
    transitiveDepth: 0,
    maintainerCount: 1,
    versionsCount: 5,
  }
}

describe('scoreMaintenanceDimension', () => {
  it('returns max score when all signals indicate abandonment (defaults)', () => {
    // defaults: days_since_last_commit=365 → f1=70, days_since_last_release=365 → f2=50
    // active_maintainer_count=1 → f3=70, bus_factor=1 → f4=80
    // 70*0.35 + 50*0.25 + 70*0.25 + 80*0.15 = 24.5 + 12.5 + 17.5 + 12 = 66.5
    const { score } = scoreMaintenanceDimension(makeInput())
    expect(score).toBeCloseTo(66.5)
  })

  it('returns 0 for a very active, well-staffed project', () => {
    const { score } = scoreMaintenanceDimension(
      makeInput({
        days_since_last_commit: 10,    // f1=0
        days_since_last_release: 30,   // f2=0
        active_maintainer_count: 5,    // f3=0
        bus_factor: 3,                 // f4=0
      })
    )
    expect(score).toBe(0)
  })

  it('f1 uses correct bracket thresholds', () => {
    const bracket = (days: number) =>
      scoreMaintenanceDimension(makeInput({
        days_since_last_commit: days,
        days_since_last_release: 0,
        active_maintainer_count: 5,
        bus_factor: 3,
      })).score

    // ≤30 → 0; ≤90 → 20*0.35=7; ≤180 → 45*0.35=15.75; ≤365 → 70*0.35=24.5; >365 → 100*0.35=35
    expect(bracket(30)).toBe(0)
    expect(bracket(91)).toBeCloseTo(15.75)
    expect(bracket(366)).toBeCloseTo(35)
  })

  it('f3 scores maintainer count correctly', () => {
    const score = (count: number) =>
      scoreMaintenanceDimension(makeInput({
        days_since_last_commit: 10,
        days_since_last_release: 30,
        active_maintainer_count: count,
        bus_factor: 3,
      })).score

    expect(score(1)).toBeCloseTo(70 * 0.25)   // f3=70
    expect(score(2)).toBeCloseTo(35 * 0.25)   // f3=35
    expect(score(3)).toBeCloseTo(15 * 0.25)   // f3=15
    expect(score(5)).toBe(0)                   // f3=0
  })

  it('f4 scores bus factor correctly', () => {
    const score = (bf: number) =>
      scoreMaintenanceDimension(makeInput({
        days_since_last_commit: 10,
        days_since_last_release: 30,
        active_maintainer_count: 5,
        bus_factor: bf,
      })).score

    expect(score(1)).toBeCloseTo(80 * 0.15)   // f4=80
    expect(score(2)).toBeCloseTo(25 * 0.15)   // f4=25
    expect(score(3)).toBe(0)                   // f4=0
  })

  it('returns 4 explanation entries with correct contribution_pct sum', () => {
    const { explanations } = scoreMaintenanceDimension(makeInput())
    expect(explanations).toHaveLength(4)
    const total = explanations.reduce((s, e) => s + e.contribution_pct, 0)
    expect(total).toBe(100)
  })

  it('explanations carry correct raw values from signals', () => {
    const { explanations } = scoreMaintenanceDimension(
      makeInput({
        days_since_last_commit: 45,
        days_since_last_release: 120,
        active_maintainer_count: 2,
        bus_factor: 2,
      })
    )
    const byFactor = Object.fromEntries(explanations.map((e) => [e.factor_name, e.raw_value]))
    expect(byFactor['days_since_last_commit']).toBe(45)
    expect(byFactor['days_since_last_release']).toBe(120)
    expect(byFactor['active_maintainer_count']).toBe(2)
    expect(byFactor['bus_factor']).toBe(2)
  })
})
