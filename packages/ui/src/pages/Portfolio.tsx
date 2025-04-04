import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  usePortfolioSummary,
  useTopRiskyPackages,
  usePortfolioChokepoints,
  useEcosystemBreakdown,
  usePortfolioTrend,
} from '../hooks/usePortfolio'
import { ScoreDistributionChart } from '../components/portfolio/ScoreDistributionChart'
import { EcosystemCard } from '../components/portfolio/EcosystemCard'
import { PortfolioTrendChart } from '../components/portfolio/PortfolioTrendChart'
import { ChokepointTable } from '../components/portfolio/ChokepointTable'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { RiskBadge } from '../components/RiskBadge'
import { EcosystemBadge } from '../components/EcosystemBadge'

type EcosystemFilter = 'all' | 'npm' | 'pypi' | 'cargo'
const ECOSYSTEM_TABS: EcosystemFilter[] = ['all', 'npm', 'pypi', 'cargo']

function scoreColor(score: number): string {
  if (score > 75) return 'var(--risk-critical)'
  if (score >= 50) return 'var(--risk-high)'
  if (score >= 25) return 'var(--risk-medium)'
  return 'var(--risk-low)'
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface MetricCardProps {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
}

function MetricCard({ label, value, sub }: MetricCardProps) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius)',
        padding: '16px 20px',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 24,
          fontWeight: 700,
          color: 'var(--text-primary)',
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export function Portfolio() {
  const [ecoFilter, setEcoFilter] = useState<EcosystemFilter>('all')
  const ecosystem = ecoFilter === 'all' ? undefined : ecoFilter

  const summary = usePortfolioSummary()
  const topRisky = useTopRiskyPackages({ ecosystem, limit: 10 })
  const chokepoints = usePortfolioChokepoints({ ecosystem, limit: 10 })
  const breakdown = useEcosystemBreakdown()
  const trend = usePortfolioTrend(10)

  return (
    <div style={{ maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          Portfolio Risk Dashboard
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Org-wide supply chain risk across all ecosystems
        </p>
      </div>

      {/* Ecosystem filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
        {ECOSYSTEM_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setEcoFilter(tab)}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius)',
              border: '1px solid',
              borderColor: ecoFilter === tab ? 'var(--accent)' : 'var(--bg-border)',
              background: ecoFilter === tab ? 'var(--accent-dim)' : 'transparent',
              color: ecoFilter === tab ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              textTransform: tab === 'all' ? 'none' : 'none',
            }}
          >
            {tab === 'all' ? 'All' : tab}
          </button>
        ))}
      </div>

      {/* Row 1 — Summary metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 28 }}>
        {summary.isLoading ? (
          <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'center', padding: 32 }}>
            <LoadingSpinner />
          </div>
        ) : summary.data ? (
          <>
            <MetricCard label="Total packages" value={summary.data.totalPackages.toLocaleString()} />
            <MetricCard
              label="Avg risk score"
              value={
                <span style={{ color: scoreColor(summary.data.avgCompositeScore) }}>
                  {summary.data.avgCompositeScore.toFixed(1)}
                </span>
              }
            />
            <MetricCard
              label="Max risk score"
              value={
                <span style={{ color: scoreColor(summary.data.maxCompositeScore) }}>
                  {summary.data.maxCompositeScore.toFixed(1)}
                </span>
              }
            />
            <MetricCard
              label="Active violations"
              value={
                <span style={{ color: summary.data.activeViolations > 0 ? 'var(--risk-critical)' : 'var(--text-primary)' }}>
                  {summary.data.activeViolations}
                </span>
              }
            />
            <MetricCard
              label="Block violations"
              value={
                <span style={{ color: summary.data.blockViolations > 0 ? 'var(--risk-critical)' : 'var(--text-primary)' }}>
                  {summary.data.blockViolations}
                </span>
              }
            />
            <MetricCard
              label="Last snapshot"
              value={
                summary.data.lastSnapshotId ? (
                  <Link
                    to={`/snapshots/${summary.data.lastSnapshotId}`}
                    style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 16 }}
                  >
                    {relativeTime(summary.data.lastSnapshotAt)}
                  </Link>
                ) : (
                  <span style={{ fontSize: 16 }}>—</span>
                )
              }
            />
          </>
        ) : null}
      </div>

      {/* Row 2 — Distribution + Ecosystem breakdown */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 28 }}>
        {/* Left 40% — donut */}
        <div
          style={{
            flex: '0 0 40%',
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, alignSelf: 'flex-start' }}>
            Score Distribution
          </div>
          {summary.isLoading ? (
            <LoadingSpinner />
          ) : summary.data ? (
            <ScoreDistributionChart distribution={summary.data.scoreDistribution} />
          ) : null}
        </div>

        {/* Right 60% — ecosystem cards */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {breakdown.isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <LoadingSpinner />
            </div>
          ) : breakdown.data ? (
            breakdown.data.map((eco) => <EcosystemCard key={eco.ecosystem} breakdown={eco} />)
          ) : null}
        </div>
      </div>

      {/* Row 3 — Trend chart */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius)',
          padding: 24,
          marginBottom: 28,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
          Risk trend over time
        </div>
        {trend.isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <LoadingSpinner />
          </div>
        ) : trend.data && trend.data.length > 0 ? (
          <PortfolioTrendChart trend={trend.data} />
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No snapshot history yet</div>
        )}
      </div>

      {/* Row 4 — Top risky + Chokepoints */}
      <div style={{ display: 'flex', gap: 24 }}>
        {/* Left 55% — top risky table */}
        <div
          style={{
            flex: '0 0 55%',
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius)',
            padding: 24,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Top risky packages
          </div>
          {topRisky.isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <LoadingSpinner />
            </div>
          ) : topRisky.data && topRisky.data.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Package', 'Ecosystem', 'Composite', 'Security', 'Blast Radius'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '6px 10px',
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        borderBottom: '1px solid var(--bg-border)',
                        fontWeight: 500,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topRisky.data.map((pkg) => (
                  <tr key={pkg.id}>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--bg-border)' }}>
                      <Link
                        to={`/packages/${pkg.ecosystem}/${encodeURIComponent(pkg.name)}`}
                        style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', textDecoration: 'none', fontSize: 12 }}
                      >
                        {pkg.name}
                      </Link>
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--bg-border)' }}>
                      <EcosystemBadge ecosystem={pkg.ecosystem} />
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--bg-border)' }}>
                      {pkg.composite_score != null ? <RiskBadge score={pkg.composite_score} /> : '—'}
                    </td>
                    <td
                      style={{
                        padding: '8px 10px',
                        borderBottom: '1px solid var(--bg-border)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: pkg.security_score != null ? scoreColor(pkg.security_score) : 'var(--text-muted)',
                      }}
                    >
                      {pkg.security_score != null ? pkg.security_score.toFixed(1) : '—'}
                    </td>
                    <td
                      style={{
                        padding: '8px 10px',
                        borderBottom: '1px solid var(--bg-border)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {(pkg as unknown as { blast_radius_score?: number }).blast_radius_score != null
                        ? ((pkg as unknown as { blast_radius_score: number }).blast_radius_score).toFixed(1)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No packages scored yet</div>
          )}
        </div>

        {/* Right 45% — chokepoints */}
        <div
          style={{
            flex: 1,
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius)',
            padding: 24,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Structural chokepoints
          </div>
          {chokepoints.isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <LoadingSpinner />
            </div>
          ) : chokepoints.data ? (
            <ChokepointTable chokepoints={chokepoints.data} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
