import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { PackageList } from './pages/PackageList'
import { PackageDetail } from './pages/PackageDetail'
import { SnapshotList } from './pages/SnapshotList'
import { GraphExplorer } from './pages/GraphExplorer'
import { SnapshotDiff } from './pages/SnapshotDiff'
import { PolicyViolations } from './pages/PolicyViolations'
import { PolicyRules } from './pages/PolicyRules'
import { Portfolio } from './pages/Portfolio'

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/packages" element={<PackageList />} />
        <Route path="/packages/:ecosystem/:name" element={<PackageDetail />} />
        <Route path="/snapshots" element={<SnapshotList />} />
        <Route path="/snapshots/diff" element={<SnapshotDiff />} />
        <Route path="/snapshots/:id" element={<div style={{ color: 'var(--text-muted)', padding: 32 }}>Snapshot detail — coming soon</div>} />
        <Route path="/graph" element={<GraphExplorer />} />
        <Route path="/policy" element={<PolicyViolations />} />
        <Route path="/policy/rules" element={<PolicyRules />} />
      </Routes>
    </Layout>
  )
}
