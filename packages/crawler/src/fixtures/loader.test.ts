import { describe, it, expect } from 'vitest'
import { loadFixture, listFixtures, loadAllFixtures } from './loader'

describe('loadFixture', () => {
  it('returns react fixture for npm/react', async () => {
    const result = await loadFixture('npm', 'react')
    expect(result).not.toBeNull()
  })

  it('returns null for nonexistent npm package', async () => {
    const result = await loadFixture('npm', 'nonexistent-package-xyz')
    expect(result).toBeNull()
  })

  it('returns requests fixture for pypi/requests', async () => {
    const result = await loadFixture('pypi', 'requests')
    expect(result).not.toBeNull()
  })

  it('npm react fixture has expected top-level keys', async () => {
    const result = await loadFixture('npm', 'react') as Record<string, unknown>
    expect(result).toHaveProperty('name', 'react')
    expect(result).toHaveProperty('versions')
    expect(result).toHaveProperty('dist-tags')
    expect(result).toHaveProperty('maintainers')
  })

  it('pypi requests fixture has expected top-level keys', async () => {
    const result = await loadFixture('pypi', 'requests') as Record<string, unknown>
    expect(result).toHaveProperty('info')
    expect(result).toHaveProperty('releases')
  })

  it('cargo serde fixture has expected top-level keys', async () => {
    const result = await loadFixture('cargo', 'serde') as Record<string, unknown>
    expect(result).toHaveProperty('crate')
    expect(result).toHaveProperty('versions')
  })

  it('returns null for nonexistent pypi package', async () => {
    const result = await loadFixture('pypi', 'no-such-package-abc')
    expect(result).toBeNull()
  })
})

describe('listFixtures', () => {
  it('npm list contains react, lodash, express', async () => {
    const result = await listFixtures('npm')
    expect(result).toContain('react')
    expect(result).toContain('lodash')
    expect(result).toContain('express')
  })

  it('cargo list contains serde and tokio', async () => {
    const result = await listFixtures('cargo')
    expect(result).toContain('serde')
    expect(result).toContain('tokio')
  })

  it('returns only .json files (no other extensions)', async () => {
    const result = await listFixtures('npm')
    for (const name of result) {
      expect(name).not.toMatch(/\.json$/)
    }
  })

  it('pypi list contains requests, numpy, django', async () => {
    const result = await listFixtures('pypi')
    expect(result).toContain('requests')
    expect(result).toContain('numpy')
    expect(result).toContain('django')
  })
})

describe('loadAllFixtures', () => {
  it('returns object with npm, pypi, cargo keys', async () => {
    const result = await loadAllFixtures()
    expect(result).toHaveProperty('npm')
    expect(result).toHaveProperty('pypi')
    expect(result).toHaveProperty('cargo')
  })

  it('all ecosystem keys are arrays', async () => {
    const result = await loadAllFixtures()
    expect(Array.isArray(result.npm)).toBe(true)
    expect(Array.isArray(result.pypi)).toBe(true)
    expect(Array.isArray(result.cargo)).toBe(true)
  })

  it('npm array has at least 3 items', async () => {
    const result = await loadAllFixtures()
    expect(result.npm.length).toBeGreaterThanOrEqual(3)
  })

  it('pypi array has at least 3 items', async () => {
    const result = await loadAllFixtures()
    expect(result.pypi.length).toBeGreaterThanOrEqual(3)
  })
})
