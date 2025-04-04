import React from 'react'
import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { PortfolioTrendPoint } from '../../lib/api'

interface PortfolioTrendChartProps {
  trend: PortfolioTrendPoint[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(iso: string): string {
  const d = new Date(iso)
  const month = MONTHS[d.getUTCMonth()] ?? 'Jan'
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${month} ${day}`
}

export function PortfolioTrendChart({ trend }: PortfolioTrendChartProps) {
  const data = trend.map((pt) => ({
    date: formatDate(pt.snapshottedAt),
    avg: pt.avgCompositeScore ?? undefined,
    max: pt.maxCompositeScore ?? undefined,
    violations: pt.violationCount ?? 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 48, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--bg-border)' }}
          tickLine={false}
        />
        <YAxis
          yAxisId="score"
          domain={[0, 100]}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--bg-border)' }}
          tickLine={false}
        />
        <YAxis
          yAxisId="violations"
          orientation="right"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--bg-border)' }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-primary)',
            fontSize: 12,
          }}
        />
        <Area
          yAxisId="score"
          type="monotone"
          dataKey="avg"
          name="Avg score"
          fill="var(--accent-dim)"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="score"
          type="monotone"
          dataKey="max"
          name="Max score"
          stroke="#ff4466"
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={false}
        />
        <Bar
          yAxisId="violations"
          dataKey="violations"
          name="Violations"
          fill="rgba(255,136,51,0.4)"
          radius={[2, 2, 0, 0]}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
