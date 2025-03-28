import React from 'react'

interface ActionBadgeProps {
  action: 'block' | 'warn' | 'require_approval'
  size?: 'sm' | 'md'
}

const CONFIG = {
  block: { color: '#ff4466', label: 'BLOCK' },
  warn: { color: '#ffcc22', label: 'WARN' },
  require_approval: { color: '#6655ff', label: 'APPROVAL' },
}

const SIZE_STYLES = {
  sm: { fontSize: 10, padding: '1px 6px' },
  md: { fontSize: 11, padding: '2px 8px' },
}

export function ActionBadge({ action, size = 'md' }: ActionBadgeProps) {
  const { color, label } = CONFIG[action]
  const sizeStyle = SIZE_STYLES[size]
  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        borderRadius: 'var(--radius)',
        background: color + '22',
        border: `1px solid ${color}66`,
        color,
        ...sizeStyle,
      }}
    >
      {label}
    </span>
  )
}
