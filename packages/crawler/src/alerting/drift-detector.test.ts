import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectDrift } from './drift-detector'

vi.mock('../snapshots/persister', () => ({
  listSnapshots: vi.fn(),
  getSnapshot: vi.fn(),
}))

import { listSnapshots, getSnapshot } from '../snapshots/persister'
import type { SnapshotData, SnapshotPackageEntry } from '../snapshots/types'

function makeEntry(overrides: Partial<SnapshotPackageEntry> & { packageId: string }): SnapshotPackageEntry {
  return {
    packageId: overrides.packageId,
    packageName: overrides.packageName ?? overrides.packageId,
    ecosystem: overrides.ecosystem ?? 'npm',
    compositeScore: overrides.compositeScore ?? 50,
    securityScore: overrides.securityScore ?? 20,
    maintenanceScore: overrides.maintenanceScore ?? 20,
    compatibilityScore: overrides.compatibilityScore ?? 20,
    concentrationScore: overrides.concentrationScore ?? 20,
    blastRadiusScore: overrides.blastRadiusScore ?? 20,
    operationalScore: overrides.operationalScore ?? 20,
    advisoryCount: overrides.advisoryCount ?? 0,
    maintainerCount: overrides.maintainerCount ?? 2,
    dependentCount: overrides.dependentCount ?? 5,
    topExplanations: [],
    ...overrides,
  }
}

function makeSnapshot(pkgs: SnapshotPackageEntry[], generatedAt = '2025-01-01T00:00:00.000Z'): SnapshotData {
  return {
    version: 1,
    generatedAt,
    packages: pkgs,
    summary: {
      totalPackages: pkgs.length,
      avgCompositeScore: 50,
      maxCompositeScore: 80,
      criticalCount: 0,
      highCount: 0,
      packagesByEcosystem: {},
    },
  }
}

function makeMockDb(rows: unknown[] = []) {
  return {
    execute: vi.fn().mockResolvedValue({ rows }),
  }
}

describe('detectDrift', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty alerts when no baseline snapshot found', async () => {
    vi.mocked(listSnapshots).mockResolvedValue([])
    const result = await detectDrift(makeMockDb(), 'snap-current')
    expect(result.alerts).toHaveLength(0)
    expect(result.baselineSnapshotId).toBeNull()
  })

  it('returns empty alerts when baseline or current snapshot missing', async () => {
    vi.mocked(listSnapshots).mockResolvedValue([
      { id: 'snap-baseline', label: null, packageCount: 5, avgCompositeScore: 50, maxCompositeScore: 80, violationCount: 0, snapshottedAt: new Date('2025-01-01') },
    ])
    vi.mocked(getSnapshot).mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    const result = await detectDrift(makeMockDb(), 'snap-current')
    expect(result.alerts).toHaveLength(0)
  })

  it('generates score_spike alert when composite score increases past threshold', async () => {
    vi.mocked(listSnapshots).mockResolvedValue([
      { id: 'snap-baseline', label: null, packageCount: 1, avgCompositeScore: 30, maxCompositeScore: 30, violationCount: 0, snapshottedAt: new Date('2025-01-01') },
    ])
    const baseline = makeSnapshot([makeEntry({ packageId: 'pkg-1', compositeScore: 30 })])
    const current = makeSnapshot([makeEntry({ packageId: 'pkg-1', compositeScore: 60 })], '2025-01-08T00:00:00.000Z')
    vi.mocked(getSnapshot).mockResolvedValueOnce(baseline).mockResolvedValueOnce(current)
    const result = await detectDrift(makeMockDb(), 'snap-current', { scoreSpikeThreshold: 15 })
    const spike = result.alerts.find((a) => a.type === 'score_spike')
    expect(spike).toBeDefined()
    expect(spike?.packageId).toBe('pkg-1')
  })

  it('generates maintainer_collapse alert when maintenance drops sharply', async () => {
    vi.mocked(listSnapshots).mockResolvedValue([
      { id: 'snap-baseline', label: null, packageCount: 1, avgCompositeScore: 30, maxCompositeScore: 30, violationCount: 0, snapshottedAt: new Date('2025-01-01') },
    ])
    const baseline = makeSnapshot([makeEntry({ packageId: 'pkg-2', compositeScore: 30, maintenanceScore: 60 })])
    const current = makeSnapshot([makeEntry({ packageId: 'pkg-2', compositeScore: 50, maintenanceScore: 30 })], '2025-01-08T00:00:00.000Z')
    vi.mocked(getSnapshot).mockResolvedValueOnce(baseline).mockResolvedValueOnce(current)
    const result = await detectDrift(makeMockDb(), 'snap-current', { scoreSpikeThreshold: 5 })
    const collapse = result.alerts.find((a) => a.type === 'maintainer_collapse')
    expect(collapse).toBeDefined()
    expect(collapse?.packageId).toBe('pkg-2')
  })

  it('generates new_vulnerability alert from newVulnerabilityChains', async () => {
    vi.mocked(listSnapshots).mockResolvedValue([
      { id: 'snap-baseline', label: null, packageCount: 1, avgCompositeScore: 30, maxCompositeScore: 30, violationCount: 0, snapshottedAt: new Date('2025-01-01') },
    ])
    const baseline = makeSnapshot([makeEntry({ packageId: 'pkg-3', compositeScore: 30, advisoryCount: 0 })])
    const current = makeSnapshot([makeEntry({ packageId: 'pkg-3', compositeScore: 55, advisoryCount: 1 })], '2025-01-08T00:00:00.000Z')
    vi.mocked(getSnapshot).mockResolvedValueOnce(baseline).mockResolvedValueOnce(current)
    const result = await detectDrift(makeMockDb(), 'snap-current', { scoreSpikeThreshold: 5 })
    const vuln = result.alerts.find((a) => a.type === 'new_vulnerability')
    expect(vuln).toBeDefined()
  })

  it('generates bus_factor_one alert for degraded packages with bus_factor=1', async () => {
    vi.mocked(listSnapshots).mockResolvedValue([
      { id: 'snap-baseline', label: null, packageCount: 1, avgCompositeScore: 30, maxCompositeScore: 30, violationCount: 0, snapshottedAt: new Date('2025-01-01') },
    ])
    const baseline = makeSnapshot([makeEntry({ packageId: 'pkg-4', compositeScore: 30 })])
    const current = makeSnapshot([makeEntry({ packageId: 'pkg-4', compositeScore: 55 })], '2025-01-08T00:00:00.000Z')
    vi.mocked(getSnapshot).mockResolvedValueOnce(baseline).mockResolvedValueOnce(current)
    const db = {
      execute: vi.fn().mockResolvedValue({ rows: [{ id: 'pkg-4', name: 'tiny-pkg', ecosystem: 'npm' }] }),
    }
    const result = await detectDrift(db, 'snap-current', { scoreSpikeThreshold: 5 })
    const bf = result.alerts.find((a) => a.type === 'bus_factor_one')
    expect(bf).toBeDefined()
    expect(bf?.packageId).toBe('pkg-4')
  })

  it('sets correct deduplication keys', async () => {
    vi.mocked(listSnapshots).mockResolvedValue([
      { id: 'snap-baseline', label: null, packageCount: 1, avgCompositeScore: 30, maxCompositeScore: 30, violationCount: 0, snapshottedAt: new Date('2025-01-01') },
    ])
    const baseline = makeSnapshot([makeEntry({ packageId: 'pkg-5', compositeScore: 20 })])
    const current = makeSnapshot([makeEntry({ packageId: 'pkg-5', compositeScore: 50 })], '2025-01-08T00:00:00.000Z')
    vi.mocked(getSnapshot).mockResolvedValueOnce(baseline).mockResolvedValueOnce(current)
    const result = await detectDrift(makeMockDb(), 'snap-current', { scoreSpikeThreshold: 15 })
    const spike = result.alerts.find((a) => a.type === 'score_spike')
    expect(spike?.deduplicationKey).toMatch(/^score_spike:pkg-5:\d+$/)
  })
})
