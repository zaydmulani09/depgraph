import React from 'react'
import { Link } from 'react-router-dom'
import type { ChokepointResult } from '../../lib/api'
import { EcosystemBadge } from '../EcosystemBadge'
import { RiskBadge } from '../RiskBadge'
import { ScoreBar } from '../ScoreBar'

interface ChokepointTableProps {
  chokepoints: ChokepointResult[]
  limit?: number
}

export function ChokepointTable({ chokepoints, limit }: ChokepointTableProps) {
  const rows = limit ? chokepoints.slice(0, limit) : chokepoints

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>
          {['Rank', 'Package', 'Ecosystem', 'Centrality', 'Risk', 'Consumers'].map((h) => (
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
        {rows.map((cp, i) => {
          const rank = i + 1
          const isTop3 = rank <= 3
          return (
            <tr
              key={cp.packageId}
              style={{
                borderLeft: isTop3 ? '3px solid #ffcc22' : '3px solid transparent',
              }}
            >
              <td
                style={{
                  padding: '8px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: isTop3 ? 700 : 400,
                  color: isTop3 ? '#ffcc22' : 'var(--text-secondary)',
                  borderBottom: '1px solid var(--bg-border)',
                }}
              >
                {rank}
              </td>
              <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--bg-border)' }}>
                <Link
                  to={`/packages/${cp.ecosystem}/${encodeURIComponent(cp.packageName)}`}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    fontSize: 12,
                  }}
                >
                  {cp.packageName}
                </Link>
              </td>
              <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--bg-border)' }}>
                <EcosystemBadge ecosystem={cp.ecosystem} />
              </td>
              <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--bg-border)', minWidth: 100 }}>
                <ScoreBar score={Math.round(cp.centralityScore * 100)} />
              </td>
              <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--bg-border)' }}>
                {cp.compositeScore != null ? (
                  <RiskBadge score={cp.compositeScore} />
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </td>
              <td
                style={{
                  padding: '8px 10px',
                  borderBottom: '1px solid var(--bg-border)',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                }}
              >
                —
              </td>
            </tr>
          )
        })}
        {rows.length === 0 && (
          <tr>
            <td
              colSpan={6}
              style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}
            >
              No chokepoints detected
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
