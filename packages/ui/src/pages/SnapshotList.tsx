import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSnapshots } from '../hooks/useSnapshots'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorMessage } from '../components/ErrorMessage'

function violationColor(count: number | null): string {
  if (!count || count === 0) return 'var(--text-muted)'
  if (count <= 5) return 'var(--risk-medium)'
  return 'var(--risk-critical)'
}

export function SnapshotList() {
  const navigate = useNavigate()
  const { data: snapshots, isLoading, isError, refetch } = useSnapshots(20)

  if (isLoading) return <LoadingSpinner label="Loading snapshots..." />
  if (isError) return <ErrorMessage message="Failed to load snapshots" retry={refetch} />

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', background: 'var(--bg-surface)' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Label</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>Packages</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>Avg Score</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>Max Score</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>Violations</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>Date</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}></th>
          </tr>
        </thead>
        <tbody>
          {(snapshots ?? []).map((s) => (
            <tr key={s.id} style={{ borderTop: '1px solid var(--bg-border)' }}>
              <td style={{ padding: '10px 12px' }}>
                <Link
                  to={`/snapshots/${s.id}`}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}
                >
                  {s.label ?? `snap-${s.id.slice(0, 8)}`}
                </Link>
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                {s.packageCount.toLocaleString()}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                {s.avgCompositeScore != null ? s.avgCompositeScore.toFixed(1) : '—'}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {s.maxCompositeScore != null ? s.maxCompositeScore.toFixed(1) : '—'}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: violationColor(s.violationCount) }}>
                {s.violationCount ?? 0}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>
                {new Date(s.snapshottedAt).toLocaleString()}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                <button
                  onClick={() => navigate(`/snapshots/diff?curr=${s.id}`)}
                  style={{
                    padding: '3px 10px',
                    fontSize: 11,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--bg-border)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Compare
                </button>
              </td>
            </tr>
          ))}
          {(snapshots ?? []).length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                No snapshots yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
