import React from 'react'
import { usePolicyRules } from '../hooks/usePolicy'
import { ActionBadge } from '../components/ActionBadge'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorMessage } from '../components/ErrorMessage'

export function PolicyRules() {
  const { data: rules, isLoading, isError, refetch } = usePolicyRules()

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Policy Rules</h1>

      {isLoading && <LoadingSpinner label="Loading rules..." />}
      {isError && <ErrorMessage message="Failed to load rules" retry={refetch} />}

      {!isLoading && !isError && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
            <thead>
              <tr
                style={{
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  background: 'var(--bg-surface)',
                }}
              >
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Name</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Description</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Action</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(rules ?? []).map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--bg-border)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {r.name}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      color: 'var(--text-muted)',
                      fontSize: 12,
                      maxWidth: 360,
                    }}
                  >
                    {r.description ?? '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <ActionBadge action={r.action} size="sm" />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {r.is_enabled ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 10,
                          background: '#44cc8822',
                          color: '#44cc88',
                          border: '1px solid #44cc8844',
                        }}
                      >
                        Enabled
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 10,
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--bg-border)',
                        }}
                      >
                        Disabled
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {(rules ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}
                  >
                    No rules found
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius)',
              padding: '14px 18px',
              fontSize: 12,
              color: 'var(--text-muted)',
              lineHeight: 1.7,
            }}
          >
            Built-in rules are seeded automatically. Custom rules can be added via the API (
            <code style={{ color: 'var(--text-code)' }}>POST /policy/rules</code>). Rule
            conditions use a JSON DSL — see{' '}
            <code style={{ color: 'var(--text-code)' }}>/openapi.json</code> for the schema.
          </div>
        </>
      )}
    </div>
  )
}
