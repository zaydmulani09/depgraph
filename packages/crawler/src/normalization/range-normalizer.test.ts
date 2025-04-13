import { describe, it, expect } from 'vitest'
import { normalizeRange } from './range-normalizer'

describe('normalizeRange — npm', () => {
  it('^1.2.3 → next major upper bound', () => {
    const r = normalizeRange('^1.2.3', 'npm')
    expect(r.lower).toBe('1.2.3')
    expect(r.lowerInclusive).toBe(true)
    expect(r.upper).toBe('2.0.0')
    expect(r.upperInclusive).toBe(false)
    expect(r.isWildcard).toBe(false)
  })

  it('~1.2.3 → next minor upper bound', () => {
    const r = normalizeRange('~1.2.3', 'npm')
    expect(r.lower).toBe('1.2.3')
    expect(r.lowerInclusive).toBe(true)
    expect(r.upper).toBe('1.3.0')
    expect(r.upperInclusive).toBe(false)
  })

  it('* → wildcard', () => {
    const r = normalizeRange('*', 'npm')
    expect(r.isWildcard).toBe(true)
  })

  it('empty string → wildcard', () => {
    const r = normalizeRange('', 'npm')
    expect(r.isWildcard).toBe(true)
  })

  it('exact version → both bounds equal and inclusive', () => {
    const r = normalizeRange('1.2.3', 'npm')
    expect(r.lower).toBe('1.2.3')
    expect(r.upper).toBe('1.2.3')
    expect(r.lowerInclusive).toBe(true)
    expect(r.upperInclusive).toBe(true)
    expect(r.isWildcard).toBe(false)
  })

  it('>=1.0.0 <2.0.0 → parsed lower/upper', () => {
    const r = normalizeRange('>=1.0.0 <2.0.0', 'npm')
    expect(r.lower).toBe('1.0.0')
    expect(r.lowerInclusive).toBe(true)
    expect(r.upper).toBe('2.0.0')
    expect(r.upperInclusive).toBe(false)
  })

  it('canonical field populated', () => {
    const r = normalizeRange('^2.0.0', 'npm')
    expect(r.canonical).toContain('>=2.0.0')
    expect(r.canonical).toContain('<3.0.0')
  })
})

describe('normalizeRange — pypi', () => {
  it('>=1.0,<2.0 → lower/upper', () => {
    const r = normalizeRange('>=1.0,<2.0', 'pypi')
    expect(r.lower).toBe('1.0')
    expect(r.lowerInclusive).toBe(true)
    expect(r.upper).toBe('2.0')
    expect(r.upperInclusive).toBe(false)
  })

  it('==1.2.3 → exact match', () => {
    const r = normalizeRange('==1.2.3', 'pypi')
    expect(r.lower).toBe('1.2.3')
    expect(r.upper).toBe('1.2.3')
    expect(r.lowerInclusive).toBe(true)
    expect(r.upperInclusive).toBe(true)
  })

  it('~=1.4 → compatible release', () => {
    const r = normalizeRange('~=1.4', 'pypi')
    expect(r.lower).toBe('1.4')
    expect(r.upper).toBe('2.0')
    expect(r.lowerInclusive).toBe(true)
    expect(r.upperInclusive).toBe(false)
  })

  it('* → wildcard', () => {
    const r = normalizeRange('*', 'pypi')
    expect(r.isWildcard).toBe(true)
  })

  it('!= → fallback (not representable)', () => {
    const r = normalizeRange('!=1.5', 'pypi')
    expect(r.lower).toBeNull()
    expect(r.upper).toBeNull()
    expect(r.isWildcard).toBe(false)
  })
})

describe('normalizeRange — cargo', () => {
  it('^1.0 → next major upper bound', () => {
    const r = normalizeRange('^1.0', 'cargo')
    expect(r.lower).toBe('1.0.0')
    expect(r.lowerInclusive).toBe(true)
    expect(r.upper).toBe('2.0.0')
    expect(r.upperInclusive).toBe(false)
  })

  it('* → wildcard', () => {
    const r = normalizeRange('*', 'cargo')
    expect(r.isWildcard).toBe(true)
  })

  it('>=1.0, <2.0 → lower/upper from multi-constraint', () => {
    const r = normalizeRange('>=1.0, <2.0', 'cargo')
    expect(r.lower).toBe('1.0.0')
    expect(r.lowerInclusive).toBe(true)
    expect(r.upper).toBe('2.0.0')
    expect(r.upperInclusive).toBe(false)
  })

  it('bare version → treated as caret', () => {
    const r = normalizeRange('1.0', 'cargo')
    expect(r.lower).toBe('1.0.0')
    expect(r.upper).toBe('2.0.0')
  })

  it('~1.2.3 → next minor', () => {
    const r = normalizeRange('~1.2.3', 'cargo')
    expect(r.lower).toBe('1.2.3')
    expect(r.upper).toBe('1.3.0')
  })
})
