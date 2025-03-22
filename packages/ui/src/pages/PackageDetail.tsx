import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  usePackageDetail,
  usePackageHistory,
  usePackageAdvisories,
  useAbandonmentScore,
} from '../hooks/usePackages'
import { RiskBadge } from '../components/RiskBadge'
import { EcosystemBadge } from '../components/EcosystemBadge'
import { ScoreBar } from '../components/ScoreBar'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorMessage } from '../components/ErrorMessage'
import { AbandonmentGauge } from '../components/forecasting/AbandonmentGauge'
import { ForecastWidget } from '../components/forecasting/ForecastWidget'
import { MaintainerTimeline } from '../components/forecasting/MaintainerTimeline'

type Tab = 'overview' | 'advisories' | 'history' | 'forecast'

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--risk-critical)',
  high: 'var(--risk-high)',
  medium: 'var(--risk-medium)',
  low: 'var(--risk-low)',
  unknown: 'var(--text-muted)',
}

export function PackageDetail() {
  const { ecosystem = '', name = '' } = useParams<{ ecosystem: string; name: string }>()
  const [tab, setTab] = useState<Tab>('overview')

  const { data: pkg, isLoading, isError, refetch } = usePackageDetail(ecosystem, name)
  const { data: history } = usePackageHistory(ecosystem, name)
  const { data: advisories } = usePackageAdvisories(ecosystem, name)
  const { data: abandonmentScore, isLoading: isLoadingAbandonment } = useAbandonmentScore(
    ecosystem,
    name
  )

  if (isLoading) return <LoadingSpinner label="Loading package..." />
  if (isError || !pkg) return <ErrorMessage message="Package not found" retry={refetch} />

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '8px 16px',
    border: 'none',
    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'transparent',
    color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: tab === t ? 600 : 400,
    transition: 'all 0.15s',
  })

  // Build signal map from detail response (first occurrence = latest value)
  const latestSignals: Record<string, number> = pkg.signals.reduce<Record<string, number>>(
    (acc, s) => {
      if (!(s.signal_name in acc)) acc[s.signal_name] = s.value
      return acc
    },
    {}
  )

  return (
    <div>
      {/* Back */}
      <Link
        to="/packages"
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 20,
        }}
      >
        ← Back to packages
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 28 }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 8,
            }}
          >
            <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700 }}>
              {pkg.name}
            </h1>
            <EcosystemBadge ecosystem={pkg.ecosystem} />
            {pkg.latest_version && (
              <span
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  borderRadius: 'var(--radius)',
                  padding: '2px 8px',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                }}
              >
                {pkg.latest_version}
              </span>
            )}
          </div>
          {pkg.description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{pkg.description}</p>
          )}
        </div>
        {pkg.composite_score != null && <RiskBadge score={pkg.composite_score} size="lg" />}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--bg-border)',
          marginBottom: 24,
        }}
      >
        <button style={tabStyle('overview')} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button style={tabStyle('advisories')} onClick={() => setTab('advisories')}>
          Advisories{' '}
          {pkg.advisoryCount > 0 && (
            <span
              style={{
                marginLeft: 4,
                background: 'var(--risk-critical)',
                color: '#000',
                borderRadius: 10,
                padding: '0 5px',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {pkg.advisoryCount}
            </span>
          )}
        </button>
        <button style={tabStyle('history')} onClick={() => setTab('history')}>
          History
        </button>
        <button style={tabStyle('forecast')} onClick={() => setTab('forecast')}>
          Forecast
        </button>
      </div>

      {/* Tab: Overview */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <div>
            <h3
              style={{
                fontSize: 13,
                color: 'var(--text-muted)',
                marginBottom: 16,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Risk Dimensions
            </h3>
            <ScoreBar score={pkg.security_score ?? 0} label="Security" showValue />
            <ScoreBar score={pkg.maintenance_score ?? 0} label="Maintenance" showValue />
            <ScoreBar score={pkg.compatibility_score ?? 0} label="Compatibility" showValue />
            <ScoreBar score={pkg.concentration_score ?? 0} label="Concentration" showValue />
            <ScoreBar score={pkg.blast_radius_score ?? 0} label="Blast Radius" showValue />
            <ScoreBar score={pkg.operational_score ?? 0} label="Operational" showValue />
          </div>

          <div>
            <h3
              style={{
                fontSize: 13,
                color: 'var(--text-muted)',
                marginBottom: 16,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Risk Explanations
            </h3>
            {pkg.explanations.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                No explanations available
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: 10,
                      textTransform: 'uppercase',
                    }}
                  >
                    <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 500 }}>
                      Factor
                    </th>
                    <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 500 }}>
                      Dim.
                    </th>
                    <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 500 }}>
                      %
                    </th>
                    <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 500 }}>
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pkg.explanations.map((e, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--bg-border)' }}>
                      <td
                        style={{
                          padding: '6px 6px',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {e.factor_name}
                      </td>
                      <td style={{ padding: '6px 6px' }}>
                        <span
                          style={{
                            background: 'var(--bg-elevated)',
                            borderRadius: 3,
                            padding: '1px 5px',
                            color: 'var(--text-secondary)',
                            fontSize: 10,
                          }}
                        >
                          {e.dimension}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '6px 6px',
                          textAlign: 'right',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--risk-medium)',
                        }}
                      >
                        {e.contribution_pct.toFixed(1)}%
                      </td>
                      <td
                        style={{
                          padding: '6px 6px',
                          color: 'var(--text-muted)',
                          maxWidth: 240,
                        }}
                      >
                        {e.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Advisories */}
      {tab === 'advisories' && (
        <div>
          {!advisories || advisories.length === 0 ? (
            <div
              style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
              <div>No known advisories</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: 11,
                    textTransform: 'uppercase',
                  }}
                >
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 500 }}>
                    ID
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 500 }}>
                    Title
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 500 }}>
                    Severity
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 500 }}>
                    CVSS
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 500 }}>
                    Published
                  </th>
                </tr>
              </thead>
              <tbody>
                {advisories.map((a) => (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--bg-border)' }}>
                    <td
                      style={{
                        padding: '10px 10px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {a.osv_id}
                    </td>
                    <td
                      style={{
                        padding: '10px 10px',
                        color: 'var(--text-primary)',
                        maxWidth: 280,
                      }}
                    >
                      {a.title}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span
                        style={{
                          color: SEVERITY_COLOR[a.severity] ?? 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          textTransform: 'uppercase',
                        }}
                      >
                        {a.severity}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '10px 10px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {a.cvss_score?.toFixed(1) ?? '—'}
                    </td>
                    <td
                      style={{
                        padding: '10px 10px',
                        textAlign: 'right',
                        color: 'var(--text-muted)',
                        fontSize: 12,
                      }}
                    >
                      {a.published_at ? new Date(a.published_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: History */}
      {tab === 'history' && (
        <div>
          {!history || history.length === 0 ? (
            <div
              style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}
            >
              No score history available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={[...history].reverse()}>
                <CartesianGrid stroke="var(--bg-border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="scored_at"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickFormatter={(v: string) => new Date(v).toLocaleDateString()}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--bg-border)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                  }}
                  labelFormatter={(v: string) => new Date(v).toLocaleString()}
                  formatter={(v: number) => [v.toFixed(1), 'Score']}
                />
                <Line
                  type="monotone"
                  dataKey="composite_score"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Tab: Forecast */}
      {tab === 'forecast' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Abandonment gauge */}
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24 }}>
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--bg-border)',
                borderRadius: 'var(--radius)',
                padding: '20px 24px',
              }}
            >
              <h4
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 16,
                }}
              >
                Abandonment Risk
              </h4>
              {isLoadingAbandonment ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 20,
                    color: 'var(--text-muted)',
                    fontSize: 13,
                  }}
                >
                  Computing…
                </div>
              ) : abandonmentScore ? (
                <AbandonmentGauge
                  probability={abandonmentScore.probability}
                  recommendation={abandonmentScore.recommendation}
                  confidence={abandonmentScore.confidence}
                  breakdown={abandonmentScore.breakdown}
                />
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  No signal data available
                </div>
              )}
            </div>

            {/* Maintainer timeline */}
            <MaintainerTimeline
              history={history ?? []}
              currentSignals={latestSignals}
            />
          </div>

          {/* 30-day forecast */}
          <ForecastWidget
            history={history ?? []}
            currentScore={pkg.composite_score ?? 0}
          />
        </div>
      )}
    </div>
  )
}
