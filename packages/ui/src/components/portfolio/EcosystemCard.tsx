import React from 'react'
import { Link } from 'react-router-dom'
import type { EcosystemBreakdown } from '../../lib/api'
import { EcosystemBadge } from '../EcosystemBadge'

interface EcosystemCardProps {
  breakdown: EcosystemBreakdown
}

const ECO_BORDER: Record<string, string> = {
  npm: '#44cc88',
  pypi: '#4499ff',
  cargo: '#ff8833',
}

function scoreColor(score: number): string {
  if (score > 75) return 'var(--risk-critical)'
  if (score >= 50) return 'var(--risk-high)'
  if (score >= 25) return 'var(--risk-medium)'
  return 'var(--risk-low)'
}

export function EcosystemCard({ breakdown }: EcosystemCardProps) {
  const borderColor = ECO_BORDER[breakdown.ecosystem] ?? 'var(--bg-border)'

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--bg-border)',
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: 'var(--radius)',
        padding: '16px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
          {breakdown.ecosystem}
        </span>
        <EcosystemBadge ecosystem={breakdown.ecosystem} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Packages indexed</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {breakdown.packageCount.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Avg risk score</div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 18,
              fontWeight: 700,
              color: scoreColor(breakdown.avgCompositeScore),
            }}
          >
            {breakdown.avgCompositeScore.toFixed(1)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Critical packages</div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 18,
              fontWeight: 700,
              color: breakdown.criticalCount > 0 ? 'var(--risk-critical)' : 'var(--text-muted)',
            }}
          >
            {breakdown.criticalCount}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Open advisories</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {breakdown.advisoryCount}
          </div>
        </div>
      </div>

      {breakdown.topRiskyPackage && (
        <div
          style={{
            borderTop: '1px solid var(--bg-border)',
            paddingTop: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>Top risk:</span>
          <Link
            to={`/packages/${breakdown.ecosystem}/${encodeURIComponent(breakdown.topRiskyPackage.name)}`}
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent)',
              textDecoration: 'none',
              fontSize: 12,
            }}
          >
            {breakdown.topRiskyPackage.name}
          </Link>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              color: scoreColor(breakdown.topRiskyPackage.score),
              marginLeft: 'auto',
            }}
          >
            {breakdown.topRiskyPackage.score.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  )
}
