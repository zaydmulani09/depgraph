import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePackages } from '../hooks/usePackages'
import { RiskBadge } from '../components/RiskBadge'
import { EcosystemBadge } from '../components/EcosystemBadge'
import { ErrorMessage } from '../components/ErrorMessage'
import { RiskSparkline } from '../components/forecasting/RiskSparkline'

function relativeTime(date: string | null): string {
  if (!date) return '—'
  const diff = Date.now() - new Date(date).getTime()
  const secs = diff / 1000
  if (secs < 60) return 'just now'
  const mins = secs / 60
  if (mins < 60) return `${Math.floor(mins)}m ago`
  const hours = mins / 60
  if (hours < 24) return `${Math.floor(hours)}h ago`
  const days = hours / 24
  if (days < 30) return `${Math.floor(days)} days ago`
  const months = days / 30
  if (months < 12) return `${Math.floor(months)} months ago`
  return `${Math.floor(months / 12)} year${Math.floor(months / 12) !== 1 ? 's' : ''} ago`
}

const ECOSYSTEMS = [
  { value: '', label: 'All' },
  { value: 'npm', label: 'npm' },
  { value: 'pypi', label: 'PyPI' },
  { value: 'cargo', label: 'Cargo' },
]

const SORTS = [
  { value: 'composite_score_desc', label: 'Riskiest first' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'updated_asc', label: 'Recently updated' },
]

function SkeletonRow() {
  return (
    <tr style={{ borderTop: '1px solid var(--bg-border)' }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} style={{ padding: '10px 8px' }}>
          <div style={{ height: 14, background: 'var(--bg-elevated)', borderRadius: 3, width: i === 0 ? '80%' : '60%', opacity: 0.6 }} />
        </td>
      ))}
    </tr>
  )
}

export function PackageList() {
  const [ecosystem, setEcosystem] = useState('')
  const [sort, setSort] = useState('composite_score_desc')
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isLoading, isError, refetch } = usePackages({
    ecosystem: ecosystem || undefined,
    sort,
    page,
    limit,
  })

  const total = data?.meta.total ?? 0
  const pages = data?.meta.pages ?? 1

  return (
    <div>
      {/* Filters row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        {/* Ecosystem tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {ECOSYSTEMS.map((e) => (
            <button
              key={e.value}
              onClick={() => { setEcosystem(e.value); setPage(1) }}
              style={{
                padding: '6px 14px',
                border: 'none',
                background: ecosystem === e.value ? 'var(--accent-dim)' : 'transparent',
                color: ecosystem === e.value ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                borderRight: '1px solid var(--bg-border)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {e.label}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1) }}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            color: 'var(--text-secondary)',
            borderRadius: 'var(--radius)',
            padding: '6px 10px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {data && (
          <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 'auto' }}>
            {total.toLocaleString()} packages
          </span>
        )}
      </div>

      {isError && <ErrorMessage message="Failed to load packages" retry={refetch} />}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', background: 'var(--bg-surface)' }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 500 }}>Name</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 500 }}>Ecosystem</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 500 }}>Risk</th>
            <th style={{ padding: '8px 10px', fontWeight: 500, width: 80 }}>Security</th>
            <th style={{ padding: '8px 10px', fontWeight: 500, width: 80 }}>Maint.</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 500 }}>Downloads</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 500 }}>Published</th>
            <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 500 }}>Trend</th>
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 20 }).map((_, i) => <SkeletonRow key={i} />)
            : (data?.data ?? []).map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid var(--bg-border)' }}>
                <td style={{ padding: '10px 10px' }}>
                  <Link
                    to={`/packages/${p.ecosystem}/${p.name}`}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}
                  >
                    {p.name}
                  </Link>
                </td>
                <td style={{ padding: '10px 10px' }}>
                  <EcosystemBadge ecosystem={p.ecosystem} />
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                  {p.composite_score != null ? <RiskBadge score={p.composite_score} size="sm" /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </td>
                <td style={{ padding: '10px 10px' }}>
                  {p.security_score != null ? (
                    <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${p.security_score}%`, background: p.security_score >= 75 ? 'var(--risk-critical)' : p.security_score >= 50 ? 'var(--risk-high)' : p.security_score >= 25 ? 'var(--risk-medium)' : 'var(--risk-low)', borderRadius: 2 }} />
                    </div>
                  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </td>
                <td style={{ padding: '10px 10px' }}>
                  {p.maintenance_score != null ? (
                    <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${p.maintenance_score}%`, background: p.maintenance_score >= 75 ? 'var(--risk-critical)' : p.maintenance_score >= 50 ? 'var(--risk-high)' : p.maintenance_score >= 25 ? 'var(--risk-medium)' : 'var(--risk-low)', borderRadius: 2 }} />
                    </div>
                  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {p.weekly_downloads != null ? p.weekly_downloads.toLocaleString() : '—'}
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>
                  {relativeTime(p.last_published_at)}
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                  {/* TODO: replace with real history when bulk history endpoint available */}
                  <RiskSparkline
                    history={
                      p.composite_score != null
                        ? [{ composite_score: p.composite_score }]
                        : []
                    }
                    width={60}
                    height={28}
                  />
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {/* Pagination */}
      {!isLoading && pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--bg-border)',
              color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              borderRadius: 'var(--radius)',
              padding: '5px 14px',
              cursor: page === 1 ? 'default' : 'pointer',
              fontSize: 13,
            }}
          >
            ← Prev
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            {page} / {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--bg-border)',
              color: page === pages ? 'var(--text-muted)' : 'var(--text-primary)',
              borderRadius: 'var(--radius)',
              padding: '5px 14px',
              cursor: page === pages ? 'default' : 'pointer',
              fontSize: 13,
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
