import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePolicyViolations, useResolveViolation } from '../hooks/usePolicy'
import { ActionBadge } from '../components/ActionBadge'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorMessage } from '../components/ErrorMessage'
import { PolicyViolation } from '../lib/api'

const PAGE_SIZE = 20

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        minWidth: 140,
        borderLeft: color ? `3px solid ${color}` : undefined,
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: color ?? 'var(--text-primary)',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

export function PolicyViolations() {
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState<
    'block' | 'warn' | 'require_approval' | undefined
  >(undefined)
  const [showResolved, setShowResolved] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const {
    data: result,
    isLoading,
    isError,
    refetch,
  } = usePolicyViolations({
    action: actionFilter,
    resolved: showResolved,
    page,
    limit: PAGE_SIZE,
  })

  const resolveBlock = usePolicyViolations({ action: 'block', resolved: false, limit: 1 })
  const resolveWarn = usePolicyViolations({ action: 'warn', resolved: false, limit: 1 })
  const resolveAll = usePolicyViolations({ resolved: false, limit: 1 })

  const mutation = useResolveViolation()

  const handleResolve = async (v: PolicyViolation) => {
    setResolvingId(v.id)
    try {
      await mutation.mutateAsync(v.id)
    } finally {
      setResolvingId(null)
    }
  }

  const violations = result?.data ?? []
  const total = result?.meta?.total ?? 0
  const totalPages = result?.meta?.pages ?? 1

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 500,
    background: active ? 'var(--accent-dim)' : 'var(--bg-elevated)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--bg-border)'}`,
    borderRadius: 'var(--radius)',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    cursor: 'pointer',
  })

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Policy Violations</h1>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Action</span>
          {(['all', 'block', 'warn', 'require_approval'] as const).map((a) => (
            <button
              key={a}
              style={filterBtnStyle(
                a === 'all' ? actionFilter === undefined : actionFilter === a
              )}
              onClick={() => {
                setActionFilter(a === 'all' ? undefined : a)
                setPage(1)
              }}
            >
              {a === 'all' ? 'All' : a === 'require_approval' ? 'Approval' : a.charAt(0).toUpperCase() + a.slice(1)}
            </button>
          ))}

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              marginLeft: 8,
            }}
          >
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => { setShowResolved(e.target.checked); setPage(1) }}
            />
            Show resolved
          </label>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard
          label="Active violations"
          value={resolveAll.data?.meta?.total ?? 0}
        />
        <StatCard
          label="Block"
          value={resolveBlock.data?.meta?.total ?? 0}
          color="#ff4466"
        />
        <StatCard
          label="Warn"
          value={resolveWarn.data?.meta?.total ?? 0}
          color="#ffcc22"
        />
      </div>

      {/* Table */}
      {isLoading && <LoadingSpinner label="Loading violations..." />}
      {isError && <ErrorMessage message="Failed to load violations" retry={refetch} />}

      {!isLoading && !isError && violations.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--risk-low)', fontSize: 15 }}>
          No active violations — your dependencies are clean ✓
        </div>
      )}

      {!isLoading && !isError && violations.length > 0 && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr
                style={{
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  background: 'var(--bg-surface)',
                }}
              >
                {['Package', 'Rule', 'Action', 'Remediation', 'Created', 'Status', ''].map(
                  (h) => (
                    <th
                      key={h}
                      style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {violations.map((v) => (
                <tr key={v.id} style={{ borderTop: '1px solid var(--bg-border)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    {v.packageName && v.ecosystem ? (
                      <Link
                        to={`/packages/${v.ecosystem}/${v.packageName}`}
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          color: 'var(--text-primary)',
                          fontWeight: 500,
                        }}
                      >
                        {v.packageName}
                      </Link>
                    ) : (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          color: 'var(--text-muted)',
                        }}
                      >
                        {v.package_id?.slice(0, 8) ?? v.id.slice(0, 8)}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>
                    {v.ruleName ?? '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <ActionBadge action={v.action} size="sm" />
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      color: 'var(--text-muted)',
                      fontSize: 12,
                      maxWidth: 240,
                    }}
                    title={v.remediation ?? undefined}
                  >
                    {v.remediation
                      ? v.remediation.length > 80
                        ? v.remediation.slice(0, 80) + '…'
                        : v.remediation
                      : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                    {timeAgo(v.created_at)}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {v.resolved_at ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 10,
                          background: '#44cc8822',
                          color: '#44cc88',
                          border: '1px solid #44cc8844',
                        }}
                      >
                        Resolved
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 10,
                          background: '#ff446622',
                          color: '#ff4466',
                          border: '1px solid #ff446644',
                        }}
                      >
                        Active
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {!v.resolved_at && (
                      <button
                        onClick={() => handleResolve(v)}
                        disabled={resolvingId === v.id}
                        style={{
                          padding: '3px 10px',
                          fontSize: 12,
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--bg-border)',
                          borderRadius: 'var(--radius)',
                          color: 'var(--text-secondary)',
                          cursor: resolvingId === v.id ? 'not-allowed' : 'pointer',
                          opacity: resolvingId === v.id ? 0.6 : 1,
                        }}
                      >
                        {resolvingId === v.id ? '…' : 'Resolve'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 16,
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>
              {total} total · page {page} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  padding: '4px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  borderRadius: 'var(--radius)',
                  color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                }}
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  padding: '4px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  borderRadius: 'var(--radius)',
                  color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                }}
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
