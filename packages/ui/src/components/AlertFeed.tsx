import React from 'react'
import { useAlerts } from '../hooks/useAlerts'
import { LoadingSpinner } from './LoadingSpinner'
import type { DepgraphAlert, AlertSeverity, AlertType } from '../lib/api'

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: '#ff4466',
  high: '#ff8833',
  medium: '#ffcc22',
  low: '#44cc88',
}

const TYPE_LABELS: Record<AlertType, string> = {
  new_vulnerability: 'Vulnerability',
  maintainer_collapse: 'Maintainer',
  score_spike: 'Score Spike',
  bus_factor_one: 'Bus Factor',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function AlertCard({ alert }: { alert: DepgraphAlert }) {
  const color = SEVERITY_COLORS[alert.severity]

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 'var(--radius)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--bg-border)',
        borderLeft: `3px solid ${color}`,
        marginBottom: 8,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 3,
              background: `${color}22`,
              color,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {alert.severity}
          </span>
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {TYPE_LABELS[alert.type]}
          </span>
          {alert.ecosystem && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{alert.ecosystem}</span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {relativeTime(alert.createdAt)}
          </span>
        </div>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 3 }}>
          {alert.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {alert.message}
        </div>
      </div>
    </div>
  )
}

interface AlertFeedProps {
  limit?: number
}

export function AlertFeed({ limit = 10 }: AlertFeedProps) {
  const { data: alerts, isLoading } = useAlerts({ limit })

  if (isLoading) return <LoadingSpinner label="Loading alerts..." />

  if (!alerts || alerts.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>
        No alerts yet. Alerts appear after drift detection runs.
      </div>
    )
  }

  return (
    <div>
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} />
      ))}
    </div>
  )
}
