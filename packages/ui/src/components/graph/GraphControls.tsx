import React from 'react'

interface GraphControlsProps {
  ecosystem: string | null
  onEcosystemChange: (eco: string | null) => void
  depth: number
  onDepthChange: (depth: number) => void
  onFitView: () => void
  onResetLayout: () => void
  nodeCount: number
  edgeCount: number
}

const ECOSYSTEMS: Array<{ label: string; value: string | null }> = [
  { label: 'All', value: null },
  { label: 'npm', value: 'npm' },
  { label: 'pypi', value: 'pypi' },
  { label: 'cargo', value: 'cargo' },
]

const DEPTHS = [1, 2, 3, 4, 5]

function Btn({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 500,
        background: active ? 'var(--accent-dim)' : 'var(--bg-elevated)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--bg-border)'}`,
        borderRadius: 'var(--radius)',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.1s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

export function GraphControls({
  ecosystem,
  onEcosystemChange,
  depth,
  onDepthChange,
  onFitView,
  onResetLayout,
  nodeCount,
  edgeCount,
}: GraphControlsProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '8px 16px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--bg-border)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      {/* Ecosystem filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Ecosystem</span>
        {ECOSYSTEMS.map(({ label, value }) => (
          <Btn key={label} active={ecosystem === value} onClick={() => onEcosystemChange(value)}>
            {label}
          </Btn>
        ))}
      </div>

      {/* Depth selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Depth</span>
        {DEPTHS.map((d) => (
          <Btn key={d} active={depth === d} onClick={() => onDepthChange(d)}>
            {d}
          </Btn>
        ))}
      </div>

      {/* View controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Btn onClick={onFitView}>Fit view</Btn>
        <Btn onClick={onResetLayout}>Reset layout</Btn>
      </div>

      {/* Stats */}
      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
        {nodeCount} nodes · {edgeCount} edges
      </span>
    </div>
  )
}
