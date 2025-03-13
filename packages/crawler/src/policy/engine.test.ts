import { describe, it, expect } from 'vitest'
import { evaluateRules, summarizeCondition } from './engine'
import type { PolicyRule } from './types'
import type { SnapshotPackageEntry } from '../snapshots/types'

function makeEntry(overrides: Partial<SnapshotPackageEntry> & { packageId: string }): SnapshotPackageEntry {
  return {
    packageId: overrides.packageId,
    packageName: overrides.packageName ?? overrides.packageId,
    ecosystem: 'npm',
    compositeScore: overrides.compositeScore ?? 50,
    securityScore: overrides.securityScore ?? 20,
    maintenanceScore: 20,
    compatibilityScore: 20,
    concentrationScore: 20,
    blastRadiusScore: 20,
    operationalScore: 20,
    advisoryCount: overrides.advisoryCount ?? 0,
    maintainerCount: overrides.maintainerCount ?? 2,
    dependentCount: overrides.dependentCount ?? 10,
    topExplanations: [],
  }
}

function makeRule(overrides: Partial<PolicyRule> & Pick<PolicyRule, 'action' | 'condition'>): PolicyRule {
  return {
    id: overrides.id ?? 'rule-1',
    name: overrides.name ?? 'test-rule',
    description: null,
    action: overrides.action,
    condition: overrides.condition,
    is_enabled: true,
    ...overrides,
  }
}

const highRiskRule = makeRule({
  id: 'rule-high',
  name: 'high-composite-risk',
  action: 'warn',
  condition: { type: 'composite_score', operator: 'gt', value: 70 },
})

const blockRule = makeRule({
  id: 'rule-block',
  name: 'block-single-maintainer',
  action: 'block',
  condition: { type: 'maintainer_count', operator: 'lte', value: 1 },
})

const pkgA = makeEntry({ packageId: 'a', compositeScore: 80, maintainerCount: 1 }) // violates both
const pkgB = makeEntry({ packageId: 'b', compositeScore: 75, maintainerCount: 3 }) // violates highRiskRule only
const pkgC = makeEntry({ packageId: 'c', compositeScore: 40, maintainerCount: 5 }) // no violation

describe('evaluateRules', () => {
  it('highRiskRule matches A and B but not C', () => {
    const results = evaluateRules([highRiskRule], [pkgA, pkgB, pkgC])
    const ids = results.map((r) => r.packageId)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).not.toContain('c')
  })

  it('two rules on three packages return correct violation count', () => {
    const results = evaluateRules([highRiskRule, blockRule], [pkgA, pkgB, pkgC])
    // pkgA → 2 violations, pkgB → 1, pkgC → 0 = 3 total
    expect(results.length).toBe(3)
  })

  it('results sorted block first then warn', () => {
    const results = evaluateRules([highRiskRule, blockRule], [pkgA, pkgB, pkgC])
    expect(results[0].action).toBe('block')
    const firstWarnIdx = results.findIndex((r) => r.action === 'warn')
    const lastBlockIdx = results.map((r) => r.action).lastIndexOf('block')
    expect(lastBlockIdx).toBeLessThan(firstWarnIdx)
  })

  it('matchedCondition is non-empty for all violations', () => {
    const results = evaluateRules([highRiskRule, blockRule], [pkgA, pkgB, pkgC])
    for (const v of results) {
      expect(v.matchedCondition.length).toBeGreaterThan(0)
    }
  })

  it('passing no rules returns empty violations', () => {
    const results = evaluateRules([], [pkgA, pkgB, pkgC])
    expect(results).toHaveLength(0)
  })

  it('only enabled rules evaluated (disabled excluded from input)', () => {
    // evaluateRules processes whatever is passed — simulating only enabled rules being passed
    const results = evaluateRules([highRiskRule], [pkgA, pkgB, pkgC])
    // blockRule not passed → no block violations
    expect(results.every((r) => r.action !== 'block')).toBe(true)
  })
})

describe('summarizeCondition', () => {
  it('composite_score primitive formats correctly', () => {
    const s = summarizeCondition({ type: 'composite_score', operator: 'gt', value: 70 }, pkgA)
    expect(s).toBe('composite_score 80 > 70')
  })

  it('and condition joins children with AND', () => {
    const s = summarizeCondition({
      type: 'and',
      conditions: [
        { type: 'maintainer_count', operator: 'lte', value: 1 },
        { type: 'composite_score', operator: 'gt', value: 70 },
      ],
    }, pkgA)
    expect(s).toContain('AND')
    expect(s).toContain('maintainer_count')
    expect(s).toContain('composite_score')
  })
})
