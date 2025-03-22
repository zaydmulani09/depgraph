import React from 'react'

interface LoadingSpinnerProps {
  size?: number
  label?: string
}

export function LoadingSpinner({ size = 24, label }: LoadingSpinnerProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
      <style>{`
        @keyframes dg-spin { to { transform: rotate(360deg); } }
        .dg-spinner { animation: dg-spin 0.8s linear infinite; }
      `}</style>
      <svg
        className="dg-spinner"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="10" stroke="var(--bg-border)" />
        <path d="M12 2 A10 10 0 0 1 22 12" />
      </svg>
      {label && <span style={{ fontSize: 13 }}>{label}</span>}
    </div>
  )
}
