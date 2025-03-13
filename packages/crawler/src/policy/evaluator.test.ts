import { describe, it, expect } from 'vitest'
import { evaluateCondition, applyOperator } from './evaluator'
import type { SnapshotPackageEntry } from '../snapshots/types'

function makeEntry(overrides: Partial<SnapshotPackageEntry> = {}): SnapshotPackageEntry {
  return {
    packageId: 'pkg-a',
    packageName: 'test-pkg',
    ecosystem: 'npm',
    compositeScore: 75,
    securityScore: 65,
    maintenanceScore: 40,
    compatibilityScore: 30,
    concentrationScore: 20,
    blastRadiusScore: 50,
    operationalScore: 25,
    advisoryCount: 2,
    maintainerCount: 1,
    dependentCount: 100,
    topExplanations: [],
    ...overrides,
  }
}

describe('applyOperator', () => {
  it('gt: 80 > 50 → true', () => expect(applyOperator(80, 'gt', 50)).toBe(true))
  it('gt: 50 > 50 → false (boundary)', () => expect(applyOperator(50, 'gt', 50)).toBe(false))
  it('gte: 50 >= 50 → true', () => expect(applyOperator(50, 'gte', 50)).toBe(true))
  it('lt: 30 < 50 → true', () => expect(applyOperator(30, 'lt', 50)).toBe(true))
  it('lte: 1 <= 1 → true', () => expect(applyOperator(1, 'lte', 1)).toBe(true))
  it('eq: 42 == 42 → true', () => expect(applyOperator(42, 'eq', 42)).toBe(true))
  it('eq: 42 == 43 → false', () => expect(applyOperator(42, 'eq', 43)).toBe(false))
})

describe('evaluateCondition', () => {
  it('composite_score gt 50 matches score 75', () => {
    expect(evaluateCondition({ type: 'composite_score', operator: 'gt', value: 50 }, makeEntry())).toBe(true)
  })

  it('composite_score gt 50 does not match score 40', () => {
    expect(evaluateCondition({ type: 'composite_score', operator: 'gt', value: 50 }, makeEntry({ compositeScore: 40 }))).toBe(false)
  })

  it('dimension_score security gte 60 matches securityScore 65', () => {
    expect(evaluateCondition({ type: 'dimension_score', dimension: 'security', operator: 'gte', value: 60 }, makeEntry())).toBe(true)
  })

  it('maintainer_count lte 1 matches maintainerCount 1', () => {
    expect(evaluateCondition({ type: 'maintainer_count', operator: 'lte', value: 1 }, makeEntry())).toBe(true)
  })

  it('dependent_count gt 500 does not match dependentCount 100', () => {
    expect(evaluateCondition({ type: 'dependent_count', operator: 'gt', value: 500 }, makeEntry())).toBe(false)
  })

  it('ecosystem npm matches npm package', () => {
    expect(evaluateCondition({ type: 'ecosystem', value: 'npm' }, makeEntry())).toBe(true)
  })

  it('ecosystem npm does not match pypi package', () => {
    expect(evaluateCondition({ type: 'ecosystem', value: 'npm' }, makeEntry({ ecosystem: 'pypi' }))).toBe(false)
  })

  it('and: both true → true', () => {
    expect(evaluateCondition({
      type: 'and',
      conditions: [
        { type: 'composite_score', operator: 'gt', value: 50 },
        { type: 'maintainer_count', operator: 'lte', value: 1 },
      ],
    }, makeEntry())).toBe(true)
  })

  it('and: one false → false', () => {
    expect(evaluateCondition({
      type: 'and',
      conditions: [
        { type: 'composite_score', operator: 'gt', value: 50 },
        { type: 'dependent_count', operator: 'gt', value: 500 },
      ],
    }, makeEntry())).toBe(false)
  })

  it('or: one true → true', () => {
    expect(evaluateCondition({
      type: 'or',
      conditions: [
        { type: 'composite_score', operator: 'gt', value: 90 },
        { type: 'maintainer_count', operator: 'lte', value: 1 },
      ],
    }, makeEntry())).toBe(true)
  })

  it('or: both false → false', () => {
    expect(evaluateCondition({
      type: 'or',
      conditions: [
        { type: 'composite_score', operator: 'gt', value: 90 },
        { type: 'dependent_count', operator: 'gt', value: 500 },
      ],
    }, makeEntry())).toBe(false)
  })

  it('not: negates true → false', () => {
    expect(evaluateCondition({
      type: 'not',
      condition: { type: 'ecosystem', value: 'npm' },
    }, makeEntry())).toBe(false)
  })

  it('not: negates false → true', () => {
    expect(evaluateCondition({
      type: 'not',
      condition: { type: 'ecosystem', value: 'pypi' },
    }, makeEntry())).toBe(true)
  })
})
