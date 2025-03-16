import { describe, it, expect } from 'vitest'
import { parseVersion, classifyUpgrade, assessBreakingRisk } from './semver'

describe('parseVersion', () => {
  it("parses '1.2.3'", () => {
    expect(parseVersion('1.2.3')).toMatchObject({ major: 1, minor: 2, patch: 3, prerelease: null })
  })

  it("parses 'v2.0.0' stripping leading v", () => {
    expect(parseVersion('v2.0.0')).toMatchObject({ major: 2, minor: 0, patch: 0, prerelease: null })
  })

  it("parses '1.2.3-alpha.1' with prerelease", () => {
    expect(parseVersion('1.2.3-alpha.1')).toMatchObject({ major: 1, minor: 2, patch: 3, prerelease: 'alpha.1' })
  })

  it("returns null for '^1.0.0' (range)", () => {
    expect(parseVersion('^1.0.0')).toBeNull()
  })

  it("returns null for 'latest'", () => {
    expect(parseVersion('latest')).toBeNull()
  })

  it("returns null for '*'", () => {
    expect(parseVersion('*')).toBeNull()
  })

  it("returns null for '>=1.0.0'", () => {
    expect(parseVersion('>=1.0.0')).toBeNull()
  })
})

describe('classifyUpgrade', () => {
  it("1.0.0 → 1.0.1 = patch", () => {
    expect(classifyUpgrade('1.0.0', '1.0.1')).toBe('patch')
  })

  it("1.0.0 → 1.1.0 = minor", () => {
    expect(classifyUpgrade('1.0.0', '1.1.0')).toBe('minor')
  })

  it("1.0.0 → 2.0.0 = major", () => {
    expect(classifyUpgrade('1.0.0', '2.0.0')).toBe('major')
  })

  it("2.0.0 → 1.0.0 = major (downgrade)", () => {
    expect(classifyUpgrade('2.0.0', '1.0.0')).toBe('major')
  })

  it("1.0.0 → 1.0.0 = patch (no change)", () => {
    expect(classifyUpgrade('1.0.0', '1.0.0')).toBe('patch')
  })

  it("'1.0.0-beta' → '1.0.1' = unknown (prerelease from)", () => {
    expect(classifyUpgrade('1.0.0-beta', '1.0.1')).toBe('unknown')
  })

  it("'^1.0.0' → '2.0.0' = unknown (unparseable)", () => {
    expect(classifyUpgrade('^1.0.0', '2.0.0')).toBe('unknown')
  })
})

describe('assessBreakingRisk', () => {
  it("patch → none", () => {
    expect(assessBreakingRisk('patch', 50, 52)).toBe('none')
  })

  it("minor, delta=5 → low", () => {
    expect(assessBreakingRisk('minor', 50, 55)).toBe('low')
  })

  it("minor, delta=15 → medium", () => {
    expect(assessBreakingRisk('minor', 40, 55)).toBe('medium')
  })

  it("major, delta=25 → high", () => {
    expect(assessBreakingRisk('major', 30, 55)).toBe('high')
  })

  it("major, delta=8 → medium", () => {
    expect(assessBreakingRisk('major', 50, 58)).toBe('medium')
  })

  it("major, delta=2 → low", () => {
    expect(assessBreakingRisk('major', 50, 52)).toBe('low')
  })

  it("unknown → medium", () => {
    expect(assessBreakingRisk('unknown', 50, 60)).toBe('medium')
  })
})
