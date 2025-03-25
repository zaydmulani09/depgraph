import React from 'react'
import { GraphNode, BlastRadiusResult } from '../../lib/api'
import { riskColor, riskLabel } from '../../lib/risk-colors'
import { LoadingSpinner } from '../LoadingSpinner'

interface NodeDetailPanelProps {
  node: GraphNode | null
  blastRadius: BlastRadiusResult | null
  isLoading: boolean
  onClose: () => void
  onNavigate: (ecosystem: string, name: string) => void
}

export function NodeDetailPanel({
  node,
  blastRadius,
  isLoading,
  onClose,
  onNavigate,
}: NodeDetailPanelProps) {
  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 300,
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--bg-border)',
        transform: node ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.2s ease',
        overflowY: 'auto',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {node && (
        <>
          {/* Header */}
          <div
            style={{
              padding: '16px 16px 12px',
              borderBottom: '1px solid var(--bg-border)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  wordBreak: 'break-all',
                  lineHeight: 1.3,
                }}
              >
                {node.name}
              </div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--bg-border)',
                  }}
                >
                  {node.ecosystem}
                </span>
                {node.compositeScore !== undefined && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 'var(--radius)',
                      background: riskColor(node.compositeScore) + '22',
                      color: riskColor(node.compositeScore),
                      border: `1px solid ${riskColor(node.compositeScore)}44`,
                    }}
                  >
                    {node.compositeScore.toFixed(0)} · {riskLabel(node.compositeScore)}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: 1,
                padding: '0 2px',
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>

          {/* Blast radius section */}
          <div style={{ padding: '14px 16px', flex: 1 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 10,
              }}
            >
              Blast Radius
            </div>

            {isLoading && (
              <div style={{ padding: '8px 0' }}>
                <LoadingSpinner size={16} label="Loading..." />
              </div>
            )}

            {!isLoading && blastRadius && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  <StatRow label="Direct consumers" value={blastRadius.directConsumers} />
                  <StatRow label="Transitive consumers" value={blastRadius.transitiveConsumers} />
                  <StatRow label="Max depth" value={blastRadius.maxDepth} />
                </div>

                {blastRadius.topConsumers.length > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginBottom: 8,
                      }}
                    >
                      Top Consumers
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {blastRadius.topConsumers.slice(0, 5).map((c) => (
                        <div
                          key={c.packageId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 8px',
                            background: 'var(--bg-elevated)',
                            borderRadius: 'var(--radius)',
                            fontSize: 12,
                          }}
                        >
                          <span
                            style={{
                              color: 'var(--text-primary)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            {c.packageName}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              color: 'var(--text-muted)',
                              background: 'var(--bg-border)',
                              padding: '1px 5px',
                              borderRadius: 3,
                              flexShrink: 0,
                              marginLeft: 6,
                            }}
                          >
                            d{c.depth}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--bg-border)' }}>
            <button
              onClick={() => onNavigate(node.ecosystem, node.name)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--accent-dim)',
                border: '1px solid var(--accent)',
                borderRadius: 'var(--radius)',
                color: 'var(--accent)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              View full details →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
      }}
    >
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
        {value.toLocaleString()}
      </span>
    </div>
  )
}
