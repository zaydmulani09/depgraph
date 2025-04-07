import { describe, it, expect } from 'vitest'
import { parsePep440, isStableRelease, comparePep440 } from './pep440'

describe('parsePep440', () => {
  it('parses simple release', () => {
    const r = parsePep440('1.2.3')!
    expect(r.epoch).toBe(0)
    expect(r.release).toEqual([1, 2, 3])
    expect(r.pre).toBeNull()
    expect(r.post).toBeNull()
    expect(r.dev).toBeNull()
    expect(r.local).toBeNull()
  })

  it('parses epoch', () => {
    const r = parsePep440('1!2.0')!
    expect(r.epoch).toBe(1)
    expect(r.release).toEqual([2, 0])
  })

  it('parses alpha pre-release', () => {
    const r = parsePep440('1.0a1')!
    expect(r.pre).toEqual({ type: 'a', n: 1 })
    expect(r.release).toEqual([1, 0])
  })

  it('parses rc with dot separator', () => {
    const r = parsePep440('1.0.rc2')!
    expect(r.pre).toEqual({ type: 'rc', n: 2 })
    expect(r.release).toEqual([1, 0])
  })

  it('parses post release', () => {
    const r = parsePep440('1.0.post1')!
    expect(r.post).toBe(1)
    expect(r.pre).toBeNull()
    expect(r.release).toEqual([1, 0])
  })

  it('parses dev release', () => {
    const r = parsePep440('1.0.dev0')!
    expect(r.dev).toBe(0)
    expect(r.pre).toBeNull()
    expect(r.release).toEqual([1, 0])
  })

  it('returns null for non-version string', () => {
    expect(parsePep440('not-a-version')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parsePep440('')).toBeNull()
  })

  it('parses beta pre-release', () => {
    const r = parsePep440('2.0b3')!
    expect(r.pre).toEqual({ type: 'b', n: 3 })
    expect(r.release).toEqual([2, 0])
  })

  it('parses local version', () => {
    const r = parsePep440('1.0+local.1')!
    expect(r.local).toBe('local.1')
    expect(r.release).toEqual([1, 0])
  })

  it('normalizes alpha to a', () => {
    const r = parsePep440('1.0alpha1')!
    expect(r.pre).toEqual({ type: 'a', n: 1 })
  })

  it('normalizes c to rc', () => {
    const r = parsePep440('1.0c1')!
    expect(r.pre).toEqual({ type: 'rc', n: 1 })
  })
})

describe('isStableRelease', () => {
  it('returns true for plain release', () => {
    expect(isStableRelease(parsePep440('1.2.3')!)).toBe(true)
  })

  it('returns false for pre-release', () => {
    expect(isStableRelease(parsePep440('1.0a1')!)).toBe(false)
  })

  it('returns false for dev release', () => {
    expect(isStableRelease(parsePep440('1.0.dev0')!)).toBe(false)
  })

  it('returns true for post release (post is stable)', () => {
    expect(isStableRelease(parsePep440('1.0.post1')!)).toBe(true)
  })
})

describe('comparePep440', () => {
  const cmp = (a: string, b: string) => {
    const pa = parsePep440(a)!
    const pb = parsePep440(b)!
    return comparePep440(pa, pb)
  }

  it('1.0.0 < 2.0.0', () => {
    expect(cmp('1.0.0', '2.0.0')).toBeLessThan(0)
  })

  it('1.0.0 < 1.1.0', () => {
    expect(cmp('1.0.0', '1.1.0')).toBeLessThan(0)
  })

  it('pre-release < release', () => {
    expect(cmp('1.0a1', '1.0')).toBeLessThan(0)
  })

  it('1.0 === 1.0.0 (padded release)', () => {
    expect(cmp('1.0', '1.0.0')).toBe(0)
  })

  it('2.0.0 > 1.9.9', () => {
    expect(cmp('2.0.0', '1.9.9')).toBeGreaterThan(0)
  })

  it('a < b < rc ordering', () => {
    expect(cmp('1.0a1', '1.0b1')).toBeLessThan(0)
    expect(cmp('1.0b1', '1.0rc1')).toBeLessThan(0)
  })

  it('dev < release', () => {
    expect(cmp('1.0.dev0', '1.0')).toBeLessThan(0)
  })

  it('release < post', () => {
    expect(cmp('1.0', '1.0.post1')).toBeLessThan(0)
  })

  it('epoch takes precedence', () => {
    expect(cmp('1!1.0', '2.0')).toBeGreaterThan(0)
  })

  it('higher pre n wins', () => {
    expect(cmp('1.0a2', '1.0a1')).toBeGreaterThan(0)
  })

  it('equal versions return 0', () => {
    expect(cmp('1.2.3', '1.2.3')).toBe(0)
  })

  it('post ordering', () => {
    expect(cmp('1.0.post2', '1.0.post1')).toBeGreaterThan(0)
  })
})
