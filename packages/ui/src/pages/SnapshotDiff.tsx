import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSnapshots } from '../hooks/useSnapshots'
import { useSnapshotDiff } from '../hooks/useDiff'
import { DiffSummaryBar } from '../components/diff/DiffSummaryBar'
import { DiffPackageRow } from '../components/diff/DiffPackageRow'
import { VulnChainAlert } from '../components/diff/VulnChainAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorMessage } from '../components/ErrorMessage'
import { SnapshotPackageEntry, SnapshotDiffEntry } from '../lib/api'

type TabKey = 'degraded' | 'improved' | 'added-removed' | 'vuln'

function formatDate(s: string) {
  return new Date(s).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TabBtn({
  active,
  onClick,
  children,
  count,
  red,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  count?: number
  red?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: 500,
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {children}
      {count !== undefined && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 10,
            background: red && count > 0 ? '#ff446622' : 'var(--bg-elevated)',
            color: red && count > 0 ? '#ff4466' : 'var(--text-muted)',
            border: '1px solid var(--bg-border)',
          }}
        >
          {count}
          {red && count > 0 && ' ●'}
        </span>
      )}
    </button>
  )
}

// ─── Selector UI ─────────────────────────────────────────────────────────────

function SnapshotSelector() {
  const navigate = useNavigate()
  const { data: snapshots } = useSnapshots(20)
  const [selectedPrev, setSelectedPrev] = useState('')
  const [selectedCurr, setSelectedCurr] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleCompare = () => {
    if (!selectedPrev || !selectedCurr) {
      setError('Select both snapshots')
      return
    }
    if (selectedPrev === selectedCurr) {
      setError('Snapshots must be different')
      return
    }
    navigate(`/snapshots/diff?prev=${selectedPrev}&curr=${selectedCurr}`)
  }

  const options = (snapshots ?? []).map((s) => ({
    value: s.id,
    label: `${s.label ?? `snap-${s.id.slice(0, 8)}`} — ${new Date(s.snapshottedAt).toLocaleDateString()} (${s.packageCount} pkgs)`,
  }))

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--bg-border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: 13,
    minWidth: 280,
  }

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', padding: '0 24px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Compare Snapshots</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>
        Select two snapshots to see what changed between them.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
            Base snapshot
          </label>
          <select
            value={selectedPrev}
            onChange={(e) => { setSelectedPrev(e.target.value); setError(null) }}
            style={selectStyle}
          >
            <option value="">Choose base...</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
            Compare snapshot
          </label>
          <select
            value={selectedCurr}
            onChange={(e) => { setSelectedCurr(e.target.value); setError(null) }}
            style={selectStyle}
          >
            <option value="">Choose compare...</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--risk-critical)', fontSize: 13, marginBottom: 12 }}>{error}</div>
      )}

      <button
        onClick={handleCompare}
        style={{
          padding: '8px 20px',
          background: 'var(--accent-dim)',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--radius)',
          color: 'var(--accent)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Compare →
      </button>
    </div>
  )
}

// ─── Main diff view ───────────────────────────────────────────────────────────

export function SnapshotDiff() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prevId = searchParams.get('prev')
  const currId = searchParams.get('curr')

  const [activeTab, setActiveTab] = useState<TabKey>('degraded')

  const { data: diff, isLoading, isError, refetch } = useSnapshotDiff(prevId, currId)

  if (!prevId || !currId) return <SnapshotSelector />

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <LoadingSpinner label="Computing diff..." />
      </div>
    )
  }

  if (isError || !diff) {
    return <ErrorMessage message="Failed to load snapshot diff" retry={refetch} />
  }

  const tabs: Array<{ key: TabKey; label: string; count: number; red?: boolean }> = [
    { key: 'degraded', label: 'Degraded', count: diff.degraded.length },
    { key: 'improved', label: 'Improved', count: diff.improved.length },
    { key: 'added-removed', label: 'Added / Removed', count: diff.added.length + diff.removed.length },
    { key: 'vuln', label: 'Vuln Chains', count: diff.newVulnerabilityChains.length, red: true },
  ]

  const handleRowClick = (entry: SnapshotPackageEntry) => {
    navigate(`/packages/${entry.ecosystem}/${entry.packageName}`)
  }

  const sortedDegraded = [...diff.degraded].sort((a, b) => b.delta - a.delta)
  const sortedImproved = [...diff.improved].sort((a, b) => a.delta - b.delta)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Snapshot Diff</h1>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          {formatDate(diff.previousGeneratedAt)} → {formatDate(diff.currentGeneratedAt)}
        </div>
        <DiffSummaryBar
          added={diff.added.length}
          removed={diff.removed.length}
          degraded={diff.degraded.length}
          improved={diff.improved.length}
          unchanged={diff.unchanged.length}
          newVulnChains={diff.newVulnerabilityChains.length}
        />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--bg-border)',
          marginBottom: 20,
          gap: 2,
        }}
      >
        {tabs.map((t) => (
          <TabBtn
            key={t.key}
            active={activeTab === t.key}
            onClick={() => setActiveTab(t.key)}
            count={t.count}
            red={t.red}
          >
            {t.label}
          </TabBtn>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'degraded' && (
        <div>
          {sortedDegraded.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--risk-low)', fontSize: 15 }}>
              No packages degraded 🎉
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 500 }}>Package</th>
                  <th style={{ textAlign: 'right', padding: '6px 12px', fontWeight: 500 }}>Score change</th>
                </tr>
              </thead>
              <tbody>
                {sortedDegraded.map((e: SnapshotDiffEntry) => (
                  <DiffPackageRow key={e.packageId} type="degraded" entry={e} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'improved' && (
        <div>
          {sortedImproved.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 15 }}>
              No packages improved in this period
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 500 }}>Package</th>
                  <th style={{ textAlign: 'right', padding: '6px 12px', fontWeight: 500 }}>Score change</th>
                </tr>
              </thead>
              <tbody>
                {sortedImproved.map((e: SnapshotDiffEntry) => (
                  <DiffPackageRow key={e.packageId} type="improved" entry={e} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'added-removed' && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {/* Added */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--risk-low)', marginBottom: 10 }}>
              Added ({diff.added.length})
            </h3>
            {diff.added.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>None</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {diff.added.map((e: SnapshotPackageEntry) => (
                    <DiffPackageRow
                      key={e.packageId}
                      type="added"
                      entry={e}
                      onClick={() => handleRowClick(e)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Removed */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--risk-critical)', marginBottom: 10 }}>
              Removed ({diff.removed.length})
            </h3>
            {diff.removed.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>None</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {diff.removed.map((e: SnapshotPackageEntry) => (
                    <DiffPackageRow key={e.packageId} type="removed" entry={e} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'vuln' && (
        <div>
          {diff.newVulnerabilityChains.length === 0 ? (
            <div
              style={{ textAlign: 'center', padding: 40, color: 'var(--risk-low)', fontSize: 15 }}
            >
              No new vulnerability chains detected ✓
            </div>
          ) : (
            diff.newVulnerabilityChains.map((chain) => (
              <VulnChainAlert key={`${chain.packageId}-${chain.advisoryId}`} chain={chain} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
