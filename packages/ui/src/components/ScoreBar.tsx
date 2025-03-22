import React, { useEffect, useRef, useState } from 'react'

function riskColor(score: number): string {
  if (score >= 75) return 'var(--risk-critical)'
  if (score >= 50) return 'var(--risk-high)'
  if (score >= 25) return 'var(--risk-medium)'
  return 'var(--risk-low)'
}

interface ScoreBarProps {
  score: number
  label: string
  showValue?: boolean
}

export function ScoreBar({ score, label, showValue = false }: ScoreBarProps) {
  const [width, setWidth] = useState(0)
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      requestAnimationFrame(() => setWidth(score))
    }
  }, [score])

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{label}</span>
        {showValue && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: riskColor(score) }}>
            {score.toFixed(1)}
          </span>
        )}
      </div>
      <div
        style={{
          height: 6,
          background: 'var(--bg-elevated)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${width}%`,
            background: riskColor(score),
            borderRadius: 3,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
    </div>
  )
}
