import { describe, it, expect } from 'vitest'
import { normalizePypiPackage } from './normalizer'
import type { PypiPackageMetadata } from './client'

function makeRelease(uploadTime: string, packagetype = 'sdist', url = 'https://files.example.com/pkg.tar.gz') {
  return [{
    filename: 'pkg.tar.gz',
    url,
    size: 10000,
    upload_time: uploadTime,
    requires_python: '>=3.8',
    packagetype,
    python_version: 'source',
    digests: { sha256: 'abc', md5: 'def' },
  }]
}

const baseMeta: PypiPackageMetadata = {
  info: {
    name: 'My_Package',
    version: '1.0.0',
    summary: 'A test package',
    home_page: 'https://example.com',
    project_url: null,
    project_urls: { Source: 'https://github.com/example/mypackage' },
    license: 'MIT',
    author: 'Test Author',
    author_email: 'test@example.com',
    maintainer: null,
    maintainer_email: null,
    requires_python: '>=3.8',
    requires_dist: ['requests>=2.28.0', 'numpy; extra == "ml"'],
    classifiers: ['Typing :: Typed'],
    keywords: 'test',
  },
  releases: {
    '1.0.0': makeRelease('2023-06-01T00:00:00'),
    '0.9.0': makeRelease('2022-01-01T00:00:00'),
    '2.0.0b1': [],
  },
  urls: [],
  last_serial: 12345,
}

describe('normalizePypiPackage', () => {
  it('normalizes package name via PEP 503', () => {
    const r = normalizePypiPackage(baseMeta)
    expect(r.package.name).toBe('my-package')
  })

  it('extracts repository_url from project_urls.Source', () => {
    const r = normalizePypiPackage(baseMeta)
    expect(r.package.repository_url).toBe('https://github.com/example/mypackage')
  })

  it('has_types true when classifiers contain Typing :: Typed', () => {
    const r = normalizePypiPackage(baseMeta)
    expect(r.versions.every((v) => v.has_types)).toBe(true)
  })

  it('excludes releases with no files', () => {
    const r = normalizePypiPackage(baseMeta)
    const versionStrings = r.versions.map((v) => v.version)
    expect(versionStrings).not.toContain('2.0.0b1')
    expect(versionStrings).toContain('1.0.0')
    expect(versionStrings).toContain('0.9.0')
  })

  it('first_published_at is earliest upload time', () => {
    const r = normalizePypiPackage(baseMeta)
    expect(r.package.first_published_at).toEqual(new Date('2022-01-01T00:00:00'))
  })

  it('parses dependencies from requires_dist', () => {
    const r = normalizePypiPackage(baseMeta)
    const reqDep = r.dependencies.find((d) => d.to_package_name === 'requests')!
    expect(reqDep).toBeDefined()
    expect(reqDep.version_range).toBe('>=2.28.0')
    expect(reqDep.is_dev).toBe(false)

    const numpyDep = r.dependencies.find((d) => d.to_package_name === 'numpy')!
    expect(numpyDep.is_dev).toBe(true)
    expect(numpyDep.is_optional).toBe(true)
  })

  it('falls back to home_page when no matching project_urls key', () => {
    const meta: PypiPackageMetadata = {
      ...baseMeta,
      info: { ...baseMeta.info, project_urls: null },
    }
    const r = normalizePypiPackage(meta)
    expect(r.package.repository_url).toBe('https://example.com')
  })

  it('builds maintainers from author fields', () => {
    const r = normalizePypiPackage(baseMeta)
    expect(r.maintainers.length).toBeGreaterThan(0)
    const m = r.maintainers[0]
    expect(m.registry_username).toBe('Test Author')
    expect(m.email).toBe('test@example.com')
  })
})
