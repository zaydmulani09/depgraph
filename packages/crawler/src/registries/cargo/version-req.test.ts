import { describe, it, expect } from 'vitest'
import { parseCargoVersionReq, cargoReqToString } from './version-req'

describe('parseCargoVersionReq', () => {
  it('parses caret requirement', () => {
    const r = parseCargoVersionReq('^1.0')
    expect(r.constraints).toHaveLength(1)
    expect(r.constraints[0]).toMatchObject({ operator: '^', major: 1, minor: 0, patch: null })
  })

  it('parses tilde requirement', () => {
    const r = parseCargoVersionReq('~1.2.3')
    expect(r.constraints).toHaveLength(1)
    expect(r.constraints[0]).toMatchObject({ operator: '~', major: 1, minor: 2, patch: 3 })
  })

  it('parses multi-constraint', () => {
    const r = parseCargoVersionReq('>=1.0, <2.0')
    expect(r.constraints).toHaveLength(2)
    expect(r.constraints[0].operator).toBe('>=')
    expect(r.constraints[0].major).toBe(1)
    expect(r.constraints[1].operator).toBe('<')
    expect(r.constraints[1].major).toBe(2)
  })

  it('bare version defaults to caret', () => {
    const r = parseCargoVersionReq('1.0')
    expect(r.constraints[0].operator).toBe('^')
    expect(r.constraints[0].major).toBe(1)
    expect(r.constraints[0].minor).toBe(0)
  })

  it('parses wildcard *', () => {
    const r = parseCargoVersionReq('*')
    expect(r.constraints[0]).toMatchObject({ operator: '*', major: null, minor: null, patch: null })
  })

  it('parses exact version', () => {
    const r = parseCargoVersionReq('=1.2.3')
    expect(r.constraints[0]).toMatchObject({ operator: '=', major: 1, minor: 2, patch: 3 })
  })

  it('parses >= requirement', () => {
    const r = parseCargoVersionReq('>=0.5')
    expect(r.constraints[0]).toMatchObject({ operator: '>=', major: 0, minor: 5, patch: null })
  })

  it('does not throw on malformed input', () => {
    expect(() => parseCargoVersionReq('not-a-version')).not.toThrow()
    const r = parseCargoVersionReq('not-a-version')
    expect(r.constraints).toHaveLength(1)
  })

  it('parses <= requirement', () => {
    const r = parseCargoVersionReq('<=2.0.0')
    expect(r.constraints[0]).toMatchObject({ operator: '<=', major: 2, minor: 0, patch: 0 })
  })

  it('preserves raw string', () => {
    const r = parseCargoVersionReq('^1.0, >=0.5')
    expect(r.raw).toBe('^1.0, >=0.5')
  })
})

describe('cargoReqToString', () => {
  it('formats caret requirement', () => {
    const r = parseCargoVersionReq('^1.0')
    expect(cargoReqToString(r)).toBe('^1.0')
  })

  it('formats wildcard', () => {
    const r = parseCargoVersionReq('*')
    expect(cargoReqToString(r)).toBe('*')
  })

  it('formats multi-constraint', () => {
    const r = parseCargoVersionReq('>=1.0, <2.0')
    const s = cargoReqToString(r)
    expect(s).toContain('>=1.0')
    expect(s).toContain('<2.0')
  })
})
