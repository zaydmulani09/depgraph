import React from 'react'
import { SnapshotDiffEntry, SnapshotPackageEntry } from '../../lib/api'

interface DiffPackageRowProps {
  type: 'added' | 'removed' | 'degraded' | 'improved'
  entry: SnapshotDiffEntry | SnapshotPackageEntry
  onClick?: () => void
}

const BORDER_COLOR = {
  added: '#44cc88',
  removed: '#ff4466',
  degraded: '#ff4466',
  improved: '#44cc88',
}

function DimChip({ name }: { name: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        padding: '1px 5px',
        background: 'var(--bg-border)',
        borderRadius: 3,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {name}
    </span>
  )
}

export function DiffPackageRow({ type, entry, onClick }: DiffPackageRowProps) {
  const borderColor = BORDER_COLOR[type]
  const isDiffEntry = type === 'degraded' || type === 'improved'
  const diff = isDiffEntry ? (entry as SnapshotDiffEntry) : null
  const pkg = !isDiffEntry ? (entry as SnapshotPackageEntry) : null

  const name = isDiffEntry ? diff!.packageName : pkg!.packageName

  return (
    <tr
      onClick={onClick}
      style={{
        borderTop: '1px solid var(--bg-border)',
        borderLeft: `3px solid ${borderColor}`,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {/* Name */}
      <td style={{ padding: '10px 12px', minWidth: 200 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
            wordBreak: 'break-all',
          }}
        >
          {name}
        </div>
        {pkg && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {pkg.ecosystem}
          </div>
        )}
        {diff && diff.changedDimensions.length > 0 && (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4 }}>
            {diff.changedDimensions.map((d) => (
              <DimChip key={d} name={d} />
            ))}
          </div>
        )}
      </td>

      {/* Score info */}
      <td style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'top' }}>
        {type === 'added' && pkg && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#44cc88' }}>
            {pkg.compositeScore.toFixed(1)}
          </span>
        )}
        {type === 'removed' && pkg && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--text-muted)',
              textDecoration: 'line-through',
            }}
          >
            {pkg.compositeScore.toFixed(1)}
          </span>
        )}
        {(type === 'degraded' || type === 'improved') && diff && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
              {diff.previousScore.toFixed(1)}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>→</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
              {diff.currentScore.toFixed(1)}
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 3,
                background: type === 'degraded' ? '#ff446622' : '#44cc8822',
                color: type === 'degraded' ? '#ff4466' : '#44cc88',
              }}
            >
              {type === 'degraded' ? '+' : ''}{diff.delta.toFixed(1)}
            </span>
          </div>
        )}
      </td>
    </tr>
  )
}
