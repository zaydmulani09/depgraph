import { describe, it, expect } from 'vitest'
import { normalizeNpmPackage } from './normalizer'
import type { NpmPackageMetadata } from './client'

const makeMinimalMeta = (overrides: Partial<NpmPackageMetadata> = {}): NpmPackageMetadata => ({
  name: 'test-pkg',
  description: 'A test package',
  homepage: 'https://example.com',
  repository: { url: 'git+https://github.com/owner/repo.git' },
  'dist-tags': { latest: '1.1.0' },
  time: {
    created: '2020-01-01T00:00:00.000Z',
    modified: '2023-06-01T00:00:00.000Z',
    '1.0.0': '2020-02-01T00:00:00.000Z',
    '1.1.0': '2023-05-01T00:00:00.000Z',
  },
  versions: {
    '1.0.0': {
      version: '1.0.0',
      license: 'MIT',
      dependencies: { lodash: '^4.0.0' },
      devDependencies: { typescript: '^5.0.0' },
      peerDependencies: { react: '>=18' },
      optionalDependencies: { fsevents: '*' },
      dist: { tarball: 'https://registry.npmjs.org/test-pkg/-/test-pkg-1.0.0.tgz' },
      maintainers: [{ name: 'alice', email: 'alice@example.com' }],
    },
    '1.1.0': {
      version: '1.1.0',
      license: 'MIT',
      types: './index.d.ts',
      deprecated: 'use v2 instead',
      dist: { tarball: 'https://registry.npmjs.org/test-pkg/-/test-pkg-1.1.0.tgz' },
    },
  },
  maintainers: [{ name: 'alice', email: 'alice@example.com' }],
  ...overrides,
})

describe('normalizeNpmPackage', () => {
  it('strips git+ prefix from repository_url', () => {
    const result = normalizeNpmPackage(makeMinimalMeta())
    expect(result.package.repository_url).toBe('https://github.com/owner/repo')
  })

  it('strips .git suffix from repository_url', () => {
    const meta = makeMinimalMeta({ repository: { url: 'https://github.com/owner/repo.git' } })
    expect(normalizeNpmPackage(meta).package.repository_url).toBe('https://github.com/owner/repo')
  })

  it('converts github: shorthand to full URL', () => {
    const meta = makeMinimalMeta({ repository: 'github:owner/myrepo' })
    expect(normalizeNpmPackage(meta).package.repository_url).toBe('https://github.com/owner/myrepo')
  })

  it('has_types is true when types field present', () => {
    const result = normalizeNpmPackage(makeMinimalMeta())
    const v110 = result.versions.find((v) => v.version === '1.1.0')
    expect(v110?.has_types).toBe(true)
  })

  it('has_types is false when no types field', () => {
    const result = normalizeNpmPackage(makeMinimalMeta())
    const v100 = result.versions.find((v) => v.version === '1.0.0')
    expect(v100?.has_types).toBe(false)
  })

  it('deprecated is true when deprecated field set', () => {
    const result = normalizeNpmPackage(makeMinimalMeta())
    const v110 = result.versions.find((v) => v.version === '1.1.0')
    expect(v110?.deprecated).toBe(true)
    expect(v110?.deprecation_message).toBe('use v2 instead')
  })

  it('first_published_at is earliest version date (not created/modified)', () => {
    const result = normalizeNpmPackage(makeMinimalMeta())
    expect(result.package.first_published_at).toEqual(new Date('2020-02-01T00:00:00.000Z'))
  })

  it('last_published_at is time.modified', () => {
    const result = normalizeNpmPackage(makeMinimalMeta())
    expect(result.package.last_published_at).toEqual(new Date('2023-06-01T00:00:00.000Z'))
  })

  it('latest_version from dist-tags.latest', () => {
    const result = normalizeNpmPackage(makeMinimalMeta())
    expect(result.package.latest_version).toBe('1.1.0')
  })

  it('categorizes dev dependencies correctly', () => {
    const result = normalizeNpmPackage(makeMinimalMeta())
    const devDep = result.dependencies.find(
      (d) => d.to_package_name === 'typescript' && d.from_version === '1.0.0'
    )
    expect(devDep?.is_dev).toBe(true)
    expect(devDep?.is_peer).toBe(false)
    expect(devDep?.is_optional).toBe(false)
  })

  it('categorizes peer dependencies correctly', () => {
    const result = normalizeNpmPackage(makeMinimalMeta())
    const peerDep = result.dependencies.find(
      (d) => d.to_package_name === 'react' && d.from_version === '1.0.0'
    )
    expect(peerDep?.is_peer).toBe(true)
    expect(peerDep?.is_dev).toBe(false)
  })

  it('categorizes optional dependencies correctly', () => {
    const result = normalizeNpmPackage(makeMinimalMeta())
    const optDep = result.dependencies.find(
      (d) => d.to_package_name === 'fsevents' && d.from_version === '1.0.0'
    )
    expect(optDep?.is_optional).toBe(true)
  })

  it('excludes versions missing from time record', () => {
    const meta = makeMinimalMeta()
    meta.versions['9.9.9'] = { version: '9.9.9' } // no time entry
    const result = normalizeNpmPackage(meta)
    expect(result.versions.find((v) => v.version === '9.9.9')).toBeUndefined()
  })

  it('collects unique maintainers', () => {
    const result = normalizeNpmPackage(makeMinimalMeta())
    expect(result.maintainers).toHaveLength(1)
    expect(result.maintainers[0].registry_username).toBe('alice')
  })
})
