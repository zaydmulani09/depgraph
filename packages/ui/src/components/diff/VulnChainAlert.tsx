import React from 'react'
import { VulnerabilityChain } from '../../lib/api'

interface VulnChainAlertProps {
  chain: VulnerabilityChain
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ff4466',
  high: '#ff8833',
  medium: '#ffcc22',
  low: '#44cc88',
}

export function VulnChainAlert({ chain }: VulnChainAlertProps) {
  const sevColor = SEVERITY_COLOR[chain.severity.toLowerCase()] ?? '#ff8833'

  return (
    <div
      style={{
        borderLeft: '3px solid var(--risk-critical)',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius)',
        padding: '12px 16px',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
          color: 'var(--risk-critical)',
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        <span>⚠</span>
        <span>New vulnerability chain detected</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--text-primary)',
            fontWeight: 600,
          }}
        >
          {chain.packageName}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 'var(--radius)',
            background: sevColor + '22',
            border: `1px solid ${sevColor}66`,
            color: sevColor,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
          }}
        >
          {chain.severity}
        </span>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
        <strong style={{ color: 'var(--text-primary)' }}>{chain.affectedDownstreamCount}</strong>{' '}
        downstream packages affected
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        Introduced {timeAgo(chain.introducedAt)}
      </div>
    </div>
  )
}
