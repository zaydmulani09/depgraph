import { describe, it, expect } from 'vitest'
import { scoreAbandonment } from './abandonment-scorer'
import type { TrendResult } from './trend-detector'

const INSUFFICIENT_TREND: TrendResult = {
  direction: 'insufficient_data',
  slope: 0,
  confidence: 0,
  firstValue: null,
  lastValue: null,
  percentChange: null,
  dataPoints: 0,
}

const STABLE_TREND: TrendResult = {
  direction: 'stable',
  slope: 0,
  confidence: 0.9,
  firstValue: 10,
  lastValue: 10,
  percentChange: 0,
  dataPoints: 5,
}

const INCREASING_TREND: TrendResult = {
  direction: 'increasing',
  slope: 2,
  confidence: 0.95,
  firstValue: 5,
  lastValue: 20,
  percentChange: 300,
  dataPoints: 5,
}

const DECLINING_HEAVY: TrendResult = {
  direction: 'decreasing',
  slope: -3,
  confidence: 0.9,
  firstValue: 100,
  lastValue: 10,
  percentChange: -90,
  dataPoints: 5,
}

describe('scoreAbandonment', () => {
  it('high-risk package → probability > 0.7 and recommendation critical', () => {
    const signals = new Map([
      ['days_since_last_commit', 400],
      ['bus_factor', 1],
      ['active_maintainer_count', 1],
    ])
    const trends = new Map([['commit_frequency_30d', DECLINING_HEAVY]])
    const result = scoreAbandonment('pkg-001', signals, trends)

    expect(result.probability).toBeGreaterThan(0.7)
    expect(result.recommendation).toBe('critical')
  })

  it('healthy package → probability < 0.3 and recommendation monitor', () => {
    const signals = new Map([
      ['days_since_last_commit', 7],
      ['bus_factor', 4],
      ['active_maintainer_count', 5],
    ])
    const trends = new Map([['commit_frequency_30d', INCREASING_TREND]])
    const result = scoreAbandonment('pkg-002', signals, trends)

    expect(result.probability).toBeLessThan(0.3)
    expect(result.recommendation).toBe('monitor')
  })

  it('missing signals use defaults without crashing', () => {
    const result = scoreAbandonment('pkg-003', new Map(), new Map())
    expect(result.probability).toBeGreaterThan(0)
    expect(result.probability).toBeLessThanOrEqual(1)
    expect(result.recommendation).toBeDefined()
  })

  it('returns confidence low when no real signal data provided', () => {
    const result = scoreAbandonment('pkg-004', new Map(), new Map())
    expect(result.confidence).toBe('low')
  })

  it('always returns exactly 4 signals', () => {
    const result = scoreAbandonment('pkg-005', new Map(), new Map())
    expect(result.signals).toHaveLength(4)
  })

  it('sum of (contribution * probability) ≈ probability', () => {
    const signals = new Map([
      ['days_since_last_commit', 200],
      ['bus_factor', 1],
      ['active_maintainer_count', 1],
    ])
    const trends = new Map([['commit_frequency_30d', STABLE_TREND]])
    const result = scoreAbandonment('pkg-006', signals, trends)

    if (result.probability > 0) {
      const sum = result.signals.reduce((s, sig) => s + sig.contribution * result.probability, 0)
      expect(sum).toBeCloseTo(result.probability, 3)
    }
  })

  it('returns confidence high when all 4 signals have real data', () => {
    const signals = new Map([
      ['days_since_last_commit', 30],
      ['bus_factor', 3],
      ['active_maintainer_count', 4],
    ])
    const trends = new Map([['commit_frequency_30d', STABLE_TREND]])
    const result = scoreAbandonment('pkg-007', signals, trends)
    // 3 from latestSignals + 1 trend = 4 real data points
    expect(result.confidence).toBe('high')
  })

  it('declining maintainer trend adds bonus to maintainer signal score', () => {
    // With 1 maintainer and declining trend, score should be higher than without trend
    const baseSigs = new Map([['active_maintainer_count', 1]])
    const declineTrend: TrendResult = {
      direction: 'decreasing',
      slope: -0.5,
      confidence: 0.8,
      firstValue: 3,
      lastValue: 1,
      percentChange: -66,
      dataPoints: 5,
    }
    const withTrend = scoreAbandonment('pkg-008', baseSigs, new Map([['active_maintainer_count', declineTrend]]))
    const withoutTrend = scoreAbandonment('pkg-008', baseSigs, new Map())
    expect(withTrend.probability).toBeGreaterThan(withoutTrend.probability)
  })
})
