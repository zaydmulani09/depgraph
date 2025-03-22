import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchHealth, type HealthResponse } from '../lib/api'
import { usePackages } from '../hooks/usePackages'
import { useSnapshots } from '../hooks/useSnapshots'
import { RiskBadge } from '../components/RiskBadge'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { AlertFeed } from '../components/AlertFeed'

function StatusPill({ label, status }: { label: string; status: 'ok' | 'error' | 'loading' }) {
  const color = status === 'ok' ? 'var(--risk-low)' : status === 'error' ? 'var(--risk-critical)' : 'var(--text-muted)'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'var(--bg-elevated)',
        border: `1px solid ${color}`,
        borderRadius: 'var(--radius)',
        padding: '4px 10px',
        fontSize: 12,
        color,
        fontFamily: 'var(--font-mono)',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        flex: 1,
      }}
    >
      <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  )
}

export function Dashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthError, setHealthError] = useState(false)

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealthError(true))
  }, [])

  const { data: packagesData } = usePackages({ limit: 5, sort: 'composite_score_desc' })
  const { data: pkgCountData } = usePackages({ limit: 1 })
  const { data: snapshots, isLoading: snapsLoading } = useSnapshots(5)

  const latestSnap = snapshots?.[0]

  return (
    <div>
      {/* Section 1 — Health */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 12, marginRight: 4 }}>Services:</span>
        <StatusPill label="API" status={health ? 'ok' : healthError ? 'error' : 'loading'} />
        <StatusPill label={`DB: ${health?.services.database ?? '…'}`} status={health?.services.database ?? 'loading'} />
        <StatusPill label={`Redis: ${health?.services.redis ?? '…'}`} status={health?.services.redis ?? 'loading'} />
      </div>

      {/* Section 2 — Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 36 }}>
        <MetricCard
          label="Packages indexed"
          value={(pkgCountData?.meta.total ?? '—').toLocaleString()}
        />
        <MetricCard
          label="Snapshot packages"
          value={latestSnap?.packageCount?.toLocaleString() ?? '—'}
        />
        <MetricCard
          label="Avg composite score"
          value={latestSnap?.avgCompositeScore != null ? latestSnap.avgCompositeScore.toFixed(1) : '—'}
        />
        <MetricCard
          label="Violations"
          value={latestSnap?.violationCount ?? '—'}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
        {/* Section 3 — Recent snapshots */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
            Recent Snapshots
          </h2>
          {snapsLoading ? (
            <LoadingSpinner label="Loading..." />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Label</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>Pkgs</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>Avg</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>Violations</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {(snapshots ?? []).map((s) => (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--bg-border)' }}>
                    <td style={{ padding: '8px 8px' }}>
                      <Link to={`/snapshots/${s.id}`} style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {s.label ?? s.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{s.packageCount}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {s.avgCompositeScore != null ? s.avgCompositeScore.toFixed(1) : '—'}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: s.violationCount ? 'var(--risk-medium)' : 'var(--text-muted)' }}>
                      {s.violationCount ?? 0}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>
                      {new Date(s.snapshottedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {(snapshots ?? []).length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 16, color: 'var(--text-muted)', textAlign: 'center' }}>No snapshots yet</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Section 4 — Top risky packages */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
            Top Risky Packages
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Name</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Eco</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>Score</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>Security</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>Maint.</th>
              </tr>
            </thead>
            <tbody>
              {(packagesData?.data ?? []).map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--bg-border)' }}>
                  <td style={{ padding: '8px 8px' }}>
                    <Link to={`/packages/${p.ecosystem}/${p.name}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
                      {p.name}
                    </Link>
                  </td>
                  <td style={{ padding: '8px 8px', color: 'var(--text-muted)', fontSize: 11 }}>{p.ecosystem}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' }}>
                    {p.composite_score != null ? <RiskBadge score={p.composite_score} size="sm" /> : '—'}
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {p.security_score?.toFixed(1) ?? '—'}
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {p.maintenance_score?.toFixed(1) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 5 — Recent Alerts */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
          Recent Alerts
        </h2>
        <AlertFeed limit={10} />
      </div>
    </div>
  )
}
