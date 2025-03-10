import { describe, it, expect } from 'vitest'
import { diffSnapshots } from './differ'
import type { SnapshotData, SnapshotPackageEntry } from './types'

function makeEntry(overrides: Partial<SnapshotPackageEntry> & { packageId: string }): SnapshotPackageEntry {
  return {
    packageId: overrides.packageId,
    packageName: overrides.packageName ?? overrides.packageId,
    ecosystem: 'npm',
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
    topExplanations: overrides.topExplanations ?? [],
  }
}

function makeSnapshot(pkgs: SnapshotPackageEntry[], generatedAt = '2025-01-01T00:00:00.000Z'): SnapshotData {
  return {
    version: 1,
    generatedAt,
    packages: pkgs,
    summary: {
      totalPackages: pkgs.length,
      avgCompositeScore: pkgs.reduce((s, p) => s + p.compositeScore, 0) / (pkgs.length || 1),
      maxCompositeScore: Math.max(0, ...pkgs.map((p) => p.compositeScore)),
      criticalCount: pkgs.filter((p) => p.compositeScore > 75).length,
      highCount: pkgs.filter((p) => p.compositeScore > 50).length,
      packagesByEcosystem: { npm: pkgs.length },
    },
  }
}

// Test fixtures
const pkgA_prev = makeEntry({ packageId: 'A', compositeScore: 40, securityScore: 10, advisoryCount: 0 })
const pkgA_curr = makeEntry({ packageId: 'A', compositeScore: 65, securityScore: 40, advisoryCount: 2 })

const pkgB_prev = makeEntry({ packageId: 'B', compositeScore: 70 })
const pkgB_curr = makeEntry({ packageId: 'B', compositeScore: 45 })

const pkgC_prev = makeEntry({ packageId: 'C', compositeScore: 50 })
const pkgC_curr = makeEntry({ packageId: 'C', compositeScore: 51 })

const pkgD_curr = makeEntry({ packageId: 'D', compositeScore: 30 })
const pkgE_prev = makeEntry({ packageId: 'E', compositeScore: 60 })

const prevSnap = makeSnapshot([pkgA_prev, pkgB_prev, pkgC_prev, pkgE_prev], '2025-01-01T00:00:00.000Z')
const currSnap = makeSnapshot([pkgA_curr, pkgB_curr, pkgC_curr, pkgD_curr], '2025-01-02T00:00:00.000Z')

describe('diffSnapshots', () => {
  const diff = diffSnapshots(prevSnap, currSnap, 'snap-prev', 'snap-curr')

  it('degraded contains A with correct delta', () => {
    const a = diff.degraded.find((e) => e.packageId === 'A')
    expect(a).toBeDefined()
    expect(a!.delta).toBeCloseTo(25)
    expect(a!.previousScore).toBe(40)
    expect(a!.currentScore).toBe(65)
  })

  it('improved contains B with correct delta', () => {
    const b = diff.improved.find((e) => e.packageId === 'B')
    expect(b).toBeDefined()
    expect(b!.delta).toBeCloseTo(-25)
    expect(b!.previousScore).toBe(70)
    expect(b!.currentScore).toBe(45)
  })

  it('unchanged contains C packageId', () => {
    expect(diff.unchanged).toContain('C')
  })

  it('added contains D entry', () => {
    const d = diff.added.find((e) => e.packageId === 'D')
    expect(d).toBeDefined()
  })

  it('removed contains E entry', () => {
    const e = diff.removed.find((e) => e.packageId === 'E')
    expect(e).toBeDefined()
  })

  it('changedDimensions on A includes security (changed > 5)', () => {
    const a = diff.degraded.find((e) => e.packageId === 'A')
    expect(a!.changedDimensions).toContain('security')
  })

  it('newVulnerabilityChains detected for A (degraded + advisoryCount increased)', () => {
    const chain = diff.newVulnerabilityChains.find((c) => c.packageId === 'A')
    expect(chain).toBeDefined()
    expect(chain!.advisoryId).toBe('detected')
    expect(chain!.introducedAt).toBe(currSnap.generatedAt)
  })

  it('identical snapshots → all unchanged, empty added/removed/degraded/improved', () => {
    const same = makeSnapshot([pkgA_prev, pkgB_prev])
    const d2 = diffSnapshots(same, same, 'x', 'y')
    expect(d2.added).toHaveLength(0)
    expect(d2.removed).toHaveLength(0)
    expect(d2.degraded).toHaveLength(0)
    expect(d2.improved).toHaveLength(0)
    expect(d2.unchanged).toHaveLength(2)
  })

  it('previousGeneratedAt and currentGeneratedAt match snapshot data', () => {
    expect(diff.previousGeneratedAt).toBe(prevSnap.generatedAt)
    expect(diff.currentGeneratedAt).toBe(currSnap.generatedAt)
  })

  it('snapshot ids passed through correctly', () => {
    expect(diff.previousSnapshotId).toBe('snap-prev')
    expect(diff.currentSnapshotId).toBe('snap-curr')
  })

  it('no vuln chain for B (improved, not degraded)', () => {
    const chain = diff.newVulnerabilityChains.find((c) => c.packageId === 'B')
    expect(chain).toBeUndefined()
  })
})
