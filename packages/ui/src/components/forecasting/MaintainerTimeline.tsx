import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { RiskHistoryPoint } from '../../lib/api'

interface MaintainerTimelineProps {
  history: RiskHistoryPoint[]
  currentSignals: Record<string, number>
}

export function MaintainerTimeline({ history, currentSignals }: MaintainerTimelineProps) {
  const sorted = [...history].sort(
    (a, b) => new Date(a.scored_at).getTime() - new Date(b.scored_at).getTime()
  )
  const chartData = sorted.map((p) => ({
    date: new Date(p.scored_at).toLocaleDateString(),
    maintenance: p.maintenance_score,
  }))

  const activeMaintainers = currentSignals['active_maintainer_count']
  const busFactor = currentSignals['bus_factor']
  const daysSinceCommit = currentSignals['days_since_last_commit']

  const chips = [
    {
      label: 'Active maintainers',
      value: activeMaintainers != null ? String(Math.round(activeMaintainers)) : 'unknown',
      alert: activeMaintainers != null && activeMaintainers <= 1,
    },
    {
      label: 'Bus factor',
      value: busFactor != null ? String(Math.round(busFactor)) : 'unknown',
      alert: busFactor != null && busFactor <= 1,
    },
    {
      label: 'Last commit',
      value: daysSinceCommit != null ? `${Math.round(daysSinceCommit)}d ago` : 'unknown',
      alert: daysSinceCommit != null && daysSinceCommit > 180,
    },
  ]

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
        Maintainer Health
      </h4>

      {chartData.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '20px 0',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
        >
          No maintenance history available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="maintGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6655ff" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6655ff" stopOpacity={0} />
              </linearGradient>
            </defs>
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
            <Area
              type="monotone"
              dataKey="maintenance"
              stroke="#6655ff"
              strokeWidth={2}
              fill="url(#maintGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {chips.map((c) => (
          <div
            key={c.label}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius)',
              padding: '6px 12px',
              flex: 1,
              minWidth: 110,
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>
              {c.label}
            </div>
            <div
              style={{
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                color: c.alert ? 'var(--risk-high)' : 'var(--text-primary)',
              }}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
