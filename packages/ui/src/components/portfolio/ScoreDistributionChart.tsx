import React from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import type { PortfolioSummary } from '../../lib/api'

interface ScoreDistributionChartProps {
  distribution: PortfolioSummary['scoreDistribution']
}

const SEGMENTS = [
  { key: 'critical' as const, label: 'Critical', fill: '#ff4466' },
  { key: 'high' as const, label: 'High', fill: '#ff8833' },
  { key: 'medium' as const, label: 'Medium', fill: '#ffcc22' },
  { key: 'low' as const, label: 'Low', fill: '#44cc88' },
  { key: 'unscored' as const, label: 'Unscored', fill: '#55556a' },
]

interface TooltipPayload {
  name: string
  value: number
}

function CustomTooltip({ active, payload, total }: { active?: boolean; payload?: TooltipPayload[]; total: number }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0'
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius)',
        padding: '8px 12px',
        fontSize: 12,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ fontWeight: 600 }}>{name}</div>
      <div>{value} packages ({pct}%)</div>
    </div>
  )
}

export function ScoreDistributionChart({ distribution }: ScoreDistributionChartProps) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0)

  const data = SEGMENTS.map((s) => ({
    name: s.label,
    value: distribution[s.key],
    fill: s.fill,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: 240, height: 240 }}>
        <PieChart width={240} height={240}>
          <Pie
            data={data}
            cx={120}
            cy={120}
            innerRadius={70}
            outerRadius={110}
            dataKey="value"
            strokeWidth={1}
            stroke="var(--bg-base)"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            content={(props) => (
              <CustomTooltip
                active={props.active}
                payload={props.payload as TooltipPayload[] | undefined}
                total={total}
              />
            )}
          />
        </PieChart>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            {total}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>packages</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 16px',
          justifyContent: 'center',
          marginTop: 12,
        }}
      >
        {SEGMENTS.map((s) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: s.fill,
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>
              {s.label} <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{distribution[s.key]}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
