import React from 'react'

interface DiffSummaryBarProps {
  added: number
  removed: number
  degraded: number
  improved: number
  unchanged: number
  newVulnChains: number
}

interface ChipProps {
  color: string
  prefix: string
  count: number
  label: string
}

function Chip({ color, prefix, count, label }: ChipProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius)',
        borderLeft: `3px solid ${color}`,
        fontSize: 12,
        fontWeight: 500,
        color,
      }}
    >
      <span style={{ fontWeight: 700 }}>{prefix}{count}</span>
      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{label}</span>
    </span>
  )
}

export function DiffSummaryBar({
  added,
  removed,
  degraded,
  improved,
  unchanged,
  newVulnChains,
}: DiffSummaryBarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Chip color="var(--risk-low)" prefix="+" count={added} label="added" />
      <Chip color="var(--text-secondary)" prefix="-" count={removed} label="removed" />
      <Chip color="var(--risk-critical)" prefix="↑" count={degraded} label="degraded" />
      <Chip color="var(--risk-none)" prefix="↓" count={improved} label="improved" />
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 10px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius)',
          borderLeft: '3px solid var(--text-muted)',
          fontSize: 12,
          color: 'var(--text-muted)',
        }}
      >
        {unchanged} unchanged
      </span>
      {newVulnChains > 0 && (
        <Chip color="var(--risk-critical)" prefix="⚠ " count={newVulnChains} label="new vuln chains" />
      )}
    </div>
  )
}
