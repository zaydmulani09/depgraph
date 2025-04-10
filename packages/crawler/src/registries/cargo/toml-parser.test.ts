import { describe, it, expect } from 'vitest'
import { parseToml, parseCargoToml } from './toml-parser'

describe('parseToml', () => {
  it('parses simple string key-value under section', () => {
    const r = parseToml('[package]\nname = "myapp"')
    expect((r['package'] as Record<string, unknown>)['name']).toBe('myapp')
  })

  it('parses integer value', () => {
    const r = parseToml('[package]\nversion = 123')
    expect((r['package'] as Record<string, unknown>)['version']).toBe(123)
  })

  it('parses boolean value', () => {
    const r = parseToml('[dependencies]\noptional = true')
    expect((r['dependencies'] as Record<string, unknown>)['optional']).toBe(true)
  })

  it('parses inline table', () => {
    const r = parseToml('[dependencies]\nserde = { version = "1", optional = true }')
    const dep = (r['dependencies'] as Record<string, unknown>)['serde'] as Record<string, unknown>
    expect(dep['version']).toBe('1')
    expect(dep['optional']).toBe(true)
  })

  it('parses inline array', () => {
    const r = parseToml('[package]\nfeatures = ["derive", "std"]')
    const features = (r['package'] as Record<string, unknown>)['features'] as string[]
    expect(features).toEqual(['derive', 'std'])
  })

  it('strips comments', () => {
    const r = parseToml('[package]\nname = "foo" # this is a comment')
    expect((r['package'] as Record<string, unknown>)['name']).toBe('foo')
  })

  it('handles multiple sections', () => {
    const toml = '[package]\nname = "myapp"\n\n[dependencies]\nserde = "1.0"'
    const r = parseToml(toml)
    expect((r['package'] as Record<string, unknown>)['name']).toBe('myapp')
    expect((r['dependencies'] as Record<string, unknown>)['serde']).toBe('1.0')
  })

  it('handles [[package]] array of tables', () => {
    const toml = '[[package]]\nname = "foo"\nversion = "1.0"\n\n[[package]]\nname = "bar"\nversion = "2.0"'
    const r = parseToml(toml)
    const pkgs = r['package'] as Array<Record<string, unknown>>
    expect(Array.isArray(pkgs)).toBe(true)
    expect(pkgs).toHaveLength(2)
    expect(pkgs[0]['name']).toBe('foo')
    expect(pkgs[1]['name']).toBe('bar')
  })

  it('handles dotted section [dependencies.serde]', () => {
    const toml = '[dependencies.serde]\nversion = "1"\nfeatures = ["derive"]'
    const r = parseToml(toml)
    const dep = (r['dependencies'] as Record<string, unknown>)['serde'] as Record<string, unknown>
    expect(dep['version']).toBe('1')
  })

  it('skips empty lines and comment-only lines', () => {
    const toml = '\n# top comment\n[package]\n# inline comment\nname = "test"\n'
    const r = parseToml(toml)
    expect((r['package'] as Record<string, unknown>)['name']).toBe('test')
  })
})

describe('parseCargoToml', () => {
  it('maps dev-dependencies to devDependencies', () => {
    const toml = '[package]\nname = "myapp"\n\n[dev-dependencies]\nvitest = "0.34"'
    const r = parseCargoToml(toml)
    expect(r.devDependencies?.['vitest']).toBe('0.34')
  })

  it('maps build-dependencies to buildDependencies', () => {
    const toml = '[build-dependencies]\ncc = "1.0"'
    const r = parseCargoToml(toml)
    expect(r.buildDependencies?.['cc']).toBe('1.0')
  })
})
