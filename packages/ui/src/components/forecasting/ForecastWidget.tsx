import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { RiskHistoryPoint } from '../../lib/api'
import { riskColor } from '../../lib/risk-colors'

interface ForecastWidgetProps {
  history: RiskHistoryPoint[]
  currentScore: number
}

interface ChartPoint {
  date: string
  real?: number
  projected?: number
}

export function ForecastWidget({ history, currentScore }: ForecastWidgetProps) {
  if (!history || history.length < 2) {
    return (
      <div
        style={{
          padding: 20,
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 13,
          background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius)',
        }}
      >
        Insufficient data for forecast
      </div>
    )
  }

  const sorted = [...history].sort(
    (a, b) => new Date(a.scored_at).getTime() - new Date(b.scored_at).getTime()
  )

  // Fit linear trend from last 5 points
  const recent = sorted.slice(-5)
  const span = Math.max(1, recent.length - 1)
  const slope =
    (recent[recent.length - 1].composite_score - recent[0].composite_score) / span

  // Project 30 units forward
  const projected = Math.max(0, Math.min(100, currentScore + slope * 30))

  // Build chart data
  const chartData: ChartPoint[] = sorted.map((p) => ({
    date: new Date(p.scored_at).toLocaleDateString(),
    real: p.composite_score,
  }))

  // Bridge: last real point also starts the projected line
  chartData[chartData.length - 1] = {
    ...chartData[chartData.length - 1],
    projected: currentScore,
  }

  // Projected endpoint 30 days out
  const future = new Date(Date.now() + 30 * 86400000)
  chartData.push({ date: future.toLocaleDateString(), projected })

  const projColor = riskColor(projected)
  const delta = projected - currentScore
  const sign = delta >= 0 ? '↑' : '↓'

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius)',
        padding: '16px 20px',
      }}
    >
      <h4
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 12,
        }}
      >
        30-Day Score Forecast
      </h4>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData}>
          <CartesianGrid stroke="var(--bg-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 12,
            }}
          />
          {/* Real history — solid accent line */}
          <Line
            type="monotone"
            dataKey="real"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
          {/* Projected — dashed, risk-colored */}
          <Line
            type="monotone"
            dataKey="projected"
            stroke={projColor}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      <p
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginTop: 10,
          textAlign: 'center',
        }}
      >
        Projected score in 30 days:{' '}
        <span
          style={{
            color: projColor,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
          }}
        >
          {projected.toFixed(0)}
        </span>{' '}
        <span style={{ color: 'var(--text-muted)' }}>
          ({sign} from {currentScore.toFixed(0)})
        </span>
      </p>
    </div>
  )
}
