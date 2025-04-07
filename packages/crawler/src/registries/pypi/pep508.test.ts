import { describe, it, expect } from 'vitest'
import { parsePep508 } from './pep508'

describe('parsePep508', () => {
  it('parses simple versioned dep', () => {
    const r = parsePep508('requests>=2.28.0')!
    expect(r.name).toBe('requests')
    expect(r.extras).toEqual([])
    expect(r.versionSpec).toBe('>=2.28.0')
    expect(r.marker).toBeNull()
    expect(r.isDev).toBe(false)
    expect(r.isOptional).toBe(false)
  })

  it('parses dep with extras', () => {
    const r = parsePep508('Django[rest]>=3.2')!
    expect(r.name).toBe('django')
    expect(r.extras).toEqual(['rest'])
    expect(r.versionSpec).toBe('>=3.2')
  })

  it('parses dep with python_version marker (not optional)', () => {
    const r = parsePep508('numpy; python_version >= "3.8"')!
    expect(r.marker).toBe('python_version >= "3.8"')
    expect(r.isOptional).toBe(false)
    expect(r.isDev).toBe(false)
  })

  it('parses extra == marker (isDev + isOptional)', () => {
    const r = parsePep508('requests; extra == "security"')!
    expect(r.isDev).toBe(true)
    expect(r.isOptional).toBe(true)
  })

  it('parses compound version spec', () => {
    const r = parsePep508('scipy>=1.0,<2.0')!
    expect(r.versionSpec).toBe('>=1.0,<2.0')
    expect(r.name).toBe('scipy')
  })

  it('normalizes package name via PEP 503', () => {
    const r = parsePep508('Pillow')!
    expect(r.name).toBe('pillow')
  })

  it('normalizes underscore in name', () => {
    const r = parsePep508('My_Package>=1.0')!
    expect(r.name).toBe('my-package')
  })

  it('returns null for empty string', () => {
    expect(parsePep508('')).toBeNull()
  })

  it('parses dep with multiple extras', () => {
    const r = parsePep508('uvicorn[standard,crypto]>=0.20')!
    expect(r.extras).toEqual(['standard', 'crypto'])
    expect(r.versionSpec).toBe('>=0.20')
  })

  it('parses dep with no version spec', () => {
    const r = parsePep508('six')!
    expect(r.name).toBe('six')
    expect(r.versionSpec).toBe('')
    expect(r.extras).toEqual([])
  })
})
