import React from 'react'

interface ErrorMessageProps {
  message: string
  retry?: () => void
}

export function ErrorMessage({ message, retry }: ErrorMessageProps) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--risk-critical)',
        borderRadius: 'var(--radius)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        color: 'var(--risk-critical)',
      }}
    >
      <span style={{ fontSize: 20 }}>⚠</span>
      <span style={{ flex: 1, color: 'var(--text-secondary)', fontSize: 13 }}>{message}</span>
      {retry && (
        <button
          onClick={retry}
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--bg-border)',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius)',
            padding: '4px 12px',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Retry
        </button>
      )}
    </div>
  )
}
