import { describe, it, expect } from 'vitest'
import { normalizeCratePackage } from './normalizer'
import type { CrateMetadata, CrateDependency } from './client'

function makeVersion(num: string, yanked = false, publishedBy?: { login: string; name: string | null; email: string | null }): CrateMetadata['versions'][0] {
  return {
    id: 1,
    crate: 'myapp',
    num,
    dl_path: `/api/v1/crates/myapp/${num}/download`,
    readme_path: null,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    downloads: 100,
    features: {},
    yanked,
    license: 'MIT',
    crate_size: 12345,
    published_by: publishedBy ?? null,
    audit_actions: [],
  }
}

const baseMeta: CrateMetadata = {
  crate: {
    id: 'myapp',
    name: 'myapp',
    description: 'A test crate',
    homepage: 'https://example.com',
    repository: 'https://github.com/example/myapp.git',
    documentation: null,
    downloads: 5000,
    recent_downloads: 500,
    max_version: '1.0.0',
    newest_version: '1.0.0',
    created_at: '2022-01-01T00:00:00Z',
    updated_at: '2023-06-01T00:00:00Z',
    keywords: [],
    categories: [],
  },
  versions: [
    makeVersion('1.0.0', false, { login: 'alice', name: 'Alice', email: 'alice@example.com' }),
    makeVersion('0.9.0', false, { login: 'alice', name: 'Alice', email: 'alice@example.com' }),
    makeVersion('0.8.0-yanked', true, { login: 'bob', name: 'Bob', email: null }),
  ],
  keywords: [],
  categories: [],
}

const normalDep: CrateDependency = {
  id: 1, version_id: 1, crate_id: 'serde', req: '^1.0',
  optional: false, default_features: true, features: [], kind: 'normal', target: null,
}
const devDep: CrateDependency = {
  id: 2, version_id: 1, crate_id: 'tokio', req: '^1.0',
  optional: false, default_features: true, features: [], kind: 'dev', target: null,
}
const buildDep: CrateDependency = {
  id: 3, version_id: 1, crate_id: 'cc', req: '^1.0',
  optional: false, default_features: true, features: [], kind: 'build', target: null,
}
const optionalDep: CrateDependency = {
  id: 4, version_id: 1, crate_id: 'rayon', req: '^1.5',
  optional: true, default_features: false, features: [], kind: 'normal', target: null,
}

describe('normalizeCratePackage', () => {
  it('preserves crate name as-is', () => {
    const r = normalizeCratePackage(baseMeta, new Map())
    expect(r.package.name).toBe('myapp')
  })

  it('strips .git from repository_url', () => {
    const r = normalizeCratePackage(baseMeta, new Map())
    expect(r.package.repository_url).toBe('https://github.com/example/myapp')
  })

  it('excludes yanked versions', () => {
    const r = normalizeCratePackage(baseMeta, new Map())
    const versionNums = r.versions.map((v) => v.version)
    expect(versionNums).not.toContain('0.8.0-yanked')
    expect(versionNums).toContain('1.0.0')
    expect(versionNums).toContain('0.9.0')
  })

  it('sets weekly_downloads from recent_downloads', () => {
    const r = normalizeCratePackage(baseMeta, new Map())
    expect(r.package.weekly_downloads).toBe(500)
  })

  it('marks is_dev true for dev deps', () => {
    const deps = new Map([['1.0.0', [normalDep, devDep]]])
    const r = normalizeCratePackage(baseMeta, deps)
    const dev = r.dependencies.find((d) => d.to_package_name === 'tokio')!
    expect(dev.is_dev).toBe(true)
    const normal = r.dependencies.find((d) => d.to_package_name === 'serde')!
    expect(normal.is_dev).toBe(false)
  })

  it('marks is_optional true for optional deps', () => {
    const deps = new Map([['1.0.0', [optionalDep]]])
    const r = normalizeCratePackage(baseMeta, deps)
    expect(r.dependencies[0].is_optional).toBe(true)
  })

  it('excludes build deps', () => {
    const deps = new Map([['1.0.0', [normalDep, buildDep]]])
    const r = normalizeCratePackage(baseMeta, deps)
    const names = r.dependencies.map((d) => d.to_package_name)
    expect(names).not.toContain('cc')
    expect(names).toContain('serde')
  })

  it('deduplicates maintainers by login', () => {
    const r = normalizeCratePackage(baseMeta, new Map())
    // alice appears in two versions, bob in one yanked version
    const usernames = r.maintainers.map((m) => m.registry_username)
    const aliceCount = usernames.filter((u) => u === 'alice').length
    expect(aliceCount).toBe(1)
  })

  it('constructs tarball_url from dl_path', () => {
    const r = normalizeCratePackage(baseMeta, new Map())
    expect(r.versions[0].tarball_url).toContain('https://crates.io')
    expect(r.versions[0].tarball_url).toContain('/download')
  })
})
