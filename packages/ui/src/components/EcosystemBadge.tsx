import React from 'react'

const COLORS: Record<string, string> = {
  npm: '#44cc88',
  pypi: '#4488ff',
  cargo: '#ff8833',
}

interface EcosystemBadgeProps {
  ecosystem: string
}

export function EcosystemBadge({ ecosystem }: EcosystemBadgeProps) {
  const color = COLORS[ecosystem] ?? 'var(--text-muted)'
  return (
    <span
      style={{
        display: 'inline-block',
        background: 'var(--bg-elevated)',
        borderLeft: `3px solid ${color}`,
        color: 'var(--text-secondary)',
        padding: '1px 7px 1px 6px',
        borderRadius: 'var(--radius)',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {ecosystem}
    </span>
  )
}
