import React from 'react'
import { NavLink } from 'react-router-dom'

interface LayoutProps {
  children: React.ReactNode
  title?: string
  actions?: React.ReactNode
}

const NAV_LINKS = [
  { to: '/', label: 'Dashboard', exact: true },
  { to: '/portfolio', label: 'Portfolio', exact: false },
  { to: '/packages', label: 'Packages', exact: false },
  { to: '/graph', label: 'Graph', exact: false },
  { to: '/policy', label: 'Policy', exact: true },
  { to: '/policy/rules', label: '  Rules', exact: false },
  { to: '/snapshots', label: 'Snapshots', exact: false },
]

export function Layout({ children, title, actions }: LayoutProps) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--bg-border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 0',
        }}
      >
        <div
          style={{
            padding: '0 20px 24px',
            borderBottom: '1px solid var(--bg-border)',
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--accent)',
              letterSpacing: '-0.02em',
            }}
          >
            depgraph
          </span>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            dependency intelligence
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0 8px' }}>
          {NAV_LINKS.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              style={({ isActive }) => ({
                display: 'block',
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                marginBottom: 2,
                fontSize: 13,
                fontWeight: 500,
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                transition: 'all 0.15s',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '16px 20px 0', borderTop: '1px solid var(--bg-border)' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            v0.1.0
          </span>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        {(title || actions) && (
          <header
            style={{
              padding: '16px 28px',
              borderBottom: '1px solid var(--bg-border)',
              background: 'var(--bg-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            {title && (
              <h1 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
                {title}
              </h1>
            )}
            {actions && <div>{actions}</div>}
          </header>
        )}

        {/* Content */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '28px',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
