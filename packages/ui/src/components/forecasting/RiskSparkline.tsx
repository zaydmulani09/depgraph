import React from 'react'
import { riskColor } from '../../lib/risk-colors'

interface RiskSparklineProps {
  history: Array<{ composite_score: number }>
  width?: number
  height?: number
  showTooltip?: boolean
}

export function RiskSparkline({
  history,
  width = 80,
  height = 32,
  showTooltip: _showTooltip = false,
}: RiskSparklineProps) {
  if (!history || history.length === 0) {
    return (
      <svg width={width} height={height}>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--bg-border)"
          strokeWidth={1.5}
        />
      </svg>
    )
  }

  if (history.length === 1) {
    return (
      <svg width={width} height={height}>
        <circle
          cx={width / 2}
          cy={height / 2}
          r={3}
          fill={riskColor(history[0].composite_score)}
        />
      </svg>
    )
  }

  const pts = history
    .map((p, i) => {
      const x = (i / (history.length - 1)) * width
      const y = (1 - p.composite_score / 100) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const lastScore = history[history.length - 1].composite_score
  const color = riskColor(lastScore)

  return (
    <svg width={width} height={height}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
