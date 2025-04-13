import { describe, it, expect } from 'vitest'
import { normalizeVersion, isPreReleaseVersion, compareVersions } from './version-normalizer'

describe('normalizeVersion', () => {
  describe('npm', () => {
    it('passes through clean semver', () => {
      expect(normalizeVersion('1.2.3', 'npm')).toBe('1.2.3')
    })

    it('strips leading v', () => {
      expect(normalizeVersion('v2.0.0', 'npm')).toBe('2.0.0')
    })

    it('preserves pre-release suffix', () => {
      expect(normalizeVersion('1.0.0-alpha.1', 'npm')).toBe('1.0.0-alpha.1')
    })

    it('returns 0.0.0 for non-semver', () => {
      expect(normalizeVersion('not-a-version', 'npm')).toBe('0.0.0')
    })

    it('returns 0.0.0 for empty string', () => {
      expect(normalizeVersion('', 'npm')).toBe('0.0.0')
    })
  })

  describe('pypi', () => {
    it('normalizes plain version', () => {
      expect(normalizeVersion('1.2.3', 'pypi')).toBe('1.2.3')
    })

    it('maps alpha pre-release to semver suffix', () => {
      expect(normalizeVersion('1.0a1', 'pypi')).toBe('1.0.0-alpha.1')
    })

    it('maps dev to semver suffix', () => {
      expect(normalizeVersion('2.0.dev0', 'pypi')).toBe('2.0.0-dev.0')
    })

    it('maps epoch to synthetic major', () => {
      const result = normalizeVersion('1!2.0', 'pypi')
      expect(result.startsWith('10002.')).toBe(true)
    })

    it('maps beta pre-release', () => {
      expect(normalizeVersion('1.0b2', 'pypi')).toBe('1.0.0-beta.2')
    })

    it('maps rc pre-release', () => {
      expect(normalizeVersion('1.0rc1', 'pypi')).toBe('1.0.0-rc.1')
    })

    it('returns 0.0.0 for unparseable', () => {
      expect(normalizeVersion('not.a.pypi.version!!!', 'pypi')).toBe('0.0.0')
    })
  })

  describe('cargo', () => {
    it('passes through semver', () => {
      expect(normalizeVersion('1.2.3', 'cargo')).toBe('1.2.3')
    })

    it('preserves pre-release', () => {
      expect(normalizeVersion('0.1.0-beta.1', 'cargo')).toBe('0.1.0-beta.1')
    })

    it('strips leading v', () => {
      expect(normalizeVersion('v1.0.0', 'cargo')).toBe('1.0.0')
    })
  })
})

describe('isPreReleaseVersion', () => {
  it('npm alpha is pre-release', () => {
    expect(isPreReleaseVersion('1.0.0-alpha', 'npm')).toBe(true)
  })

  it('npm stable is not pre-release', () => {
    expect(isPreReleaseVersion('1.0.0', 'npm')).toBe(false)
  })

  it('pypi alpha is pre-release', () => {
    expect(isPreReleaseVersion('1.0a1', 'pypi')).toBe(true)
  })

  it('pypi stable is not pre-release', () => {
    expect(isPreReleaseVersion('1.0.0', 'pypi')).toBe(false)
  })

  it('cargo beta is pre-release', () => {
    expect(isPreReleaseVersion('1.0.0-beta', 'cargo')).toBe(true)
  })

  it('cargo stable is not pre-release', () => {
    expect(isPreReleaseVersion('1.0.0', 'cargo')).toBe(false)
  })

  it('pypi dev is pre-release', () => {
    expect(isPreReleaseVersion('1.0.dev0', 'pypi')).toBe(true)
  })
})

describe('compareVersions', () => {
  it('npm: higher major wins', () => {
    expect(compareVersions('2.0.0', '1.0.0', 'npm')).toBeGreaterThan(0)
  })

  it('npm: equal versions return 0', () => {
    expect(compareVersions('1.0.0', '1.0.0', 'npm')).toBe(0)
  })

  it('npm: pre-release < stable', () => {
    expect(compareVersions('1.0.0-alpha', '1.0.0', 'npm')).toBeLessThan(0)
  })

  it('pypi: uses PEP 440 comparison', () => {
    expect(compareVersions('1.0a1', '1.0', 'pypi')).toBeLessThan(0)
  })

  it('pypi: stable comparison', () => {
    expect(compareVersions('2.0.0', '1.0.0', 'pypi')).toBeGreaterThan(0)
  })

  it('cargo: standard semver comparison', () => {
    expect(compareVersions('1.1.0', '1.0.0', 'cargo')).toBeGreaterThan(0)
  })
})
