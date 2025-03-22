import React from 'react'

function riskColor(score: number): string {
  if (score >= 75) return 'var(--risk-critical)'
  if (score >= 50) return 'var(--risk-high)'
  if (score >= 25) return 'var(--risk-medium)'
  return 'var(--risk-low)'
}

interface RiskBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
}

const SIZE: Record<string, React.CSSProperties> = {
  sm: { fontSize: 11, padding: '1px 6px' },
  md: { fontSize: 13, padding: '2px 8px' },
  lg: { fontSize: 18, padding: '4px 14px', fontWeight: 700 },
}

export function RiskBadge({ score, size = 'md' }: RiskBadgeProps) {
  const bg = riskColor(score)
  const style: React.CSSProperties = {
    display: 'inline-block',
    background: bg,
    color: '#000',
    borderRadius: 'var(--radius)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
    lineHeight: 1.4,
    ...SIZE[size],
  }
  return <span style={style}>{score.toFixed(1)}</span>
}
