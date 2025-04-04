import React from 'react'
import type { AbandonmentScoreResult } from '../../lib/api'

interface AbandonmentGaugeProps {
  probability: number
  recommendation: 'monitor' | 'warn' | 'critical'
  confidence: 'high' | 'medium' | 'low'
  breakdown: AbandonmentScoreResult['breakdown']
}

function gaugeColor(p: number): string {
  if (p >= 0.7) return '#ff4466'
  if (p >= 0.4) return '#ffcc22'
  return '#44cc88'
}

const REC_COLOR: Record<string, string> = {
  monitor: '#44cc88',
  warn: '#ffcc22',
  critical: '#ff4466',
}

export function AbandonmentGauge({
  probability,
  recommendation,
  confidence,
  breakdown,
}: AbandonmentGaugeProps) {
  // Clamp to avoid degenerate SVG arcs
  const p = Math.max(0.001, Math.min(0.999, probability))
  const cx = 50
  const cy = 50
  const r = 40

  // Fill arc end point: sweeps from left (angle=π) to right (angle=0) as p goes 0→1
  const angle = Math.PI * (1 - p)
  const endX = cx + r * Math.cos(angle)
  const endY = cy - r * Math.sin(angle)
  // large-arc-flag: our fill arc spans at most π radians, never "large" until degenerate
  const largeArc = p > 0.5 ? 1 : 0

  const color = gaugeColor(probability)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* SVG arc gauge */}
      <svg viewBox="0 0 100 55" style={{ width: '100%', maxWidth: 220 }}>
        {/* Background track */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="var(--bg-border)"
          strokeWidth={8}
          strokeLinecap="round"
        />
        {/* Fill arc */}
        <path
          d={`M 10 50 A 40 40 0 ${largeArc} 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
        />
        {/* Probability label */}
        <text
          x="50"
          y="44"
          textAnchor="middle"
          fontSize="18"
          fontWeight="700"
          fill="var(--text-primary)"
          fontFamily="var(--font-mono)"
        >
          {Math.round(probability * 100)}%
        </text>
      </svg>

      {/* Recommendation + confidence */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            background: REC_COLOR[recommendation] + '22',
            color: REC_COLOR[recommendation],
            border: `1px solid ${REC_COLOR[recommendation]}55`,
            borderRadius: 4,
            padding: '3px 12px',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {recommendation}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>confidence: {confidence}</span>
      </div>

      {/* Breakdown bars */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
        {breakdown.map((sig) => (
          <div key={sig.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sig.description}</span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: gaugeColor(sig.score),
                }}
              >
                {sig.score.toFixed(2)}
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2 }}>
              <div
                style={{
                  height: '100%',
                  width: `${sig.score * 100}%`,
                  background: gaugeColor(sig.score),
                  borderRadius: 2,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
