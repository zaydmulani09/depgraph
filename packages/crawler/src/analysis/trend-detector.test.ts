import { describe, it, expect } from 'vitest'
import { linearRegression, computeTrend } from './trend-detector'
import type { SignalSeries } from './timeseries'

// Helper: build a SignalSeries from an array of values, 1 day apart
function makeSeries(values: number[], baseMs = new Date('2024-01-01').getTime()): SignalSeries {
  return {
    packageId: 'test-pkg',
    signalName: 'test',
    points: values.map((value, i) => ({
      value,
      measured_at: new Date(baseMs + i * 86400000),
    })),
  }
}

describe('linearRegression', () => {
  it('fits y = 2x + 1 perfectly (slope ≈ 2, R² ≈ 1)', () => {
    const points = [0, 1, 2, 3, 4].map((x) => ({ x, y: 2 * x + 1 }))
    const { slope, r2 } = linearRegression(points)
    expect(slope).toBeCloseTo(2, 5)
    expect(r2).toBeCloseTo(1.0, 5)
  })

  it('returns slope ≈ 0 for flat data', () => {
    const points = [0, 1, 2, 3, 4].map((x) => ({ x, y: 5 }))
    const { slope } = linearRegression(points)
    expect(Math.abs(slope)).toBeLessThan(1e-10)
  })

  it('returns slope 0 and R² 0 for a single point', () => {
    const { slope, r2 } = linearRegression([{ x: 100, y: 42 }])
    expect(slope).toBe(0)
    expect(r2).toBe(0)
  })

  it('returns slope 0, intercept 0, R² 0 for empty input', () => {
    const { slope, intercept, r2 } = linearRegression([])
    expect(slope).toBe(0)
    expect(intercept).toBe(0)
    expect(r2).toBe(0)
  })

  it('fits negative slope correctly', () => {
    const points = [0, 1, 2, 3, 4].map((x) => ({ x, y: 10 - 3 * x }))
    const { slope, r2 } = linearRegression(points)
    expect(slope).toBeCloseTo(-3, 4)
    expect(r2).toBeCloseTo(1.0, 4)
  })
})

describe('computeTrend', () => {
  it('returns insufficient_data when fewer than 3 points', () => {
    const result = computeTrend(makeSeries([10, 20]))
    expect(result.direction).toBe('insufficient_data')
    expect(result.slope).toBe(0)
    expect(result.confidence).toBe(0)
  })

  it('returns insufficient_data for empty series', () => {
    const result = computeTrend(makeSeries([]))
    expect(result.direction).toBe('insufficient_data')
    expect(result.dataPoints).toBe(0)
  })

  it('returns increasing for a steadily rising series', () => {
    // Large slope in signal-value-per-day space ensures slope > 0.01
    const result = computeTrend(makeSeries([10, 20, 30, 40, 50]))
    expect(result.direction).toBe('increasing')
    expect(result.slope).toBeGreaterThan(0.01)
    expect(result.confidence).toBeGreaterThan(0.8)
  })

  it('returns decreasing for a steadily falling series', () => {
    const result = computeTrend(makeSeries([50, 40, 30, 20, 10]))
    expect(result.direction).toBe('decreasing')
    expect(result.slope).toBeLessThan(-0.01)
    expect(result.confidence).toBeGreaterThan(0.8)
  })

  it('returns stable for a flat series', () => {
    const result = computeTrend(makeSeries([5, 5, 5, 5, 5]))
    expect(result.direction).toBe('stable')
  })

  it('computes percentChange correctly: 10 → 20 = 100%', () => {
    const result = computeTrend(makeSeries([10, 14, 17, 20]))
    expect(result.percentChange).toBeCloseTo(100, 0)
    expect(result.firstValue).toBe(10)
    expect(result.lastValue).toBe(20)
  })

  it('sets percentChange to null when firstValue is 0', () => {
    const result = computeTrend(makeSeries([0, 5, 10, 15, 20]))
    expect(result.percentChange).toBeNull()
  })

  it('counts data points correctly', () => {
    const result = computeTrend(makeSeries([1, 2, 3, 4, 5, 6, 7]))
    expect(result.dataPoints).toBe(7)
  })

  it('respects custom minPoints option', () => {
    // With minPoints=5, a 4-point series should return insufficient_data
    const result = computeTrend(makeSeries([1, 2, 3, 4]), { minPoints: 5 })
    expect(result.direction).toBe('insufficient_data')
  })
})
