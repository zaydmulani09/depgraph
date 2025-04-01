import type { SignalSeries } from './timeseries'

export type TrendDirection = 'increasing' | 'decreasing' | 'stable' | 'insufficient_data'

export interface TrendResult {
  direction: TrendDirection
  slope: number
  confidence: number
  firstValue: number | null
  lastValue: number | null
  percentChange: number | null
  dataPoints: number
}

// ─── Linear regression ────────────────────────────────────────────────────────

export function linearRegression(
  points: Array<{ x: number; y: number }>
): { slope: number; intercept: number; r2: number } {
  const n = points.length
  if (n === 0) return { slope: 0, intercept: 0, r2: 0 }
  if (n === 1) return { slope: 0, intercept: points[0].y, r2: 0 }

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0

  for (const p of points) {
    sumX += p.x
    sumY += p.y
    sumXY += p.x * p.y
    sumX2 += p.x * p.x
  }

  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 }

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  // R²
  const meanY = sumY / n
  let ssTot = 0
  let ssRes = 0
  for (const p of points) {
    const predicted = slope * p.x + intercept
    ssTot += (p.y - meanY) ** 2
    ssRes += (p.y - predicted) ** 2
  }

  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot)
  return { slope, intercept, r2 }
}

// ─── Trend computation ────────────────────────────────────────────────────────

export function computeTrend(
  series: SignalSeries,
  options?: { minPoints?: number }
): TrendResult {
  const minPoints = options?.minPoints ?? 3
  const { points } = series

  if (points.length < minPoints) {
    return {
      direction: 'insufficient_data',
      slope: 0,
      confidence: 0,
      firstValue: points.length > 0 ? points[0].value : null,
      lastValue: points.length > 0 ? points[points.length - 1].value : null,
      percentChange: null,
      dataPoints: points.length,
    }
  }

  // Convert timestamps to days-since-epoch
  const xyPoints = points.map((p) => ({
    x: Math.floor(p.measured_at.getTime() / 86400000),
    y: p.value,
  }))

  const { slope, r2 } = linearRegression(xyPoints)

  const firstValue = points[0].value
  const lastValue = points[points.length - 1].value

  const percentChange =
    firstValue !== 0
      ? ((lastValue - firstValue) / Math.abs(firstValue)) * 100
      : null

  // Direction classification
  let direction: TrendDirection
  if (Math.abs(slope) < 0.01 || r2 < 0.2) {
    direction = 'stable'
  } else if (slope > 0.01 && r2 >= 0.2) {
    direction = 'increasing'
  } else {
    direction = 'decreasing'
  }

  return {
    direction,
    slope,
    confidence: r2,
    firstValue,
    lastValue,
    percentChange,
    dataPoints: points.length,
  }
}
