import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}))

import { readFile } from 'node:fs/promises'
import { parseManifest } from './manifest-parser'

const mockReadFile = readFile as ReturnType<typeof vi.fn>

describe('manifest-parser — npm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('parses dependencies and devDependencies into flat list', async () => {
    const pkg = {
      dependencies: { lodash: '^4.0.0', express: '~4.18.0' },
      devDependencies: { jest: '^29.0.0' },
    }
    mockReadFile.mockResolvedValue(JSON.stringify(pkg))
    const result = await parseManifest('package.json', 'npm')
    expect(result.ecosystem).toBe('npm')
    expect(result.dependencies).toHaveLength(3)
  })

  it('sets isDev: false for dependencies', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ dependencies: { lodash: '^4.0.0' } }))
    const result = await parseManifest('package.json', 'npm')
    const dep = result.dependencies.find((d) => d.name === 'lodash')
    expect(dep?.isDev).toBe(false)
  })

  it('sets isDev: true for devDependencies', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ devDependencies: { jest: '^29.0.0' } }))
    const result = await parseManifest('package.json', 'npm')
    const dep = result.dependencies.find((d) => d.name === 'jest')
    expect(dep?.isDev).toBe(true)
  })

  it('handles package.json with no devDependencies', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ dependencies: { express: '^4.0.0' } }))
    const result = await parseManifest('package.json', 'npm')
    expect(result.dependencies).toHaveLength(1)
  })
})

describe('manifest-parser — pypi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('parses >= version spec', async () => {
    mockReadFile.mockResolvedValue('requests>=2.28.0\n')
    const result = await parseManifest('requirements.txt', 'pypi')
    const dep = result.dependencies.find((d) => d.name === 'requests')
    expect(dep?.versionRange).toBe('>=2.28.0')
  })

  it('skips comment lines', async () => {
    mockReadFile.mockResolvedValue('# comment\nrequests>=2.28.0\n')
    const result = await parseManifest('requirements.txt', 'pypi')
    expect(result.dependencies).toHaveLength(1)
  })

  it('uses * for lines with no version spec', async () => {
    mockReadFile.mockResolvedValue('requests\n')
    const result = await parseManifest('requirements.txt', 'pypi')
    expect(result.dependencies[0]?.versionRange).toBe('*')
  })

  it('parses == operator', async () => {
    mockReadFile.mockResolvedValue('flask==2.0.0\n')
    const result = await parseManifest('requirements.txt', 'pypi')
    const dep = result.dependencies.find((d) => d.name === 'flask')
    expect(dep?.versionRange).toBe('==2.0.0')
  })

  it('skips empty lines', async () => {
    mockReadFile.mockResolvedValue('\n\nrequests>=2.28.0\n\n')
    const result = await parseManifest('requirements.txt', 'pypi')
    expect(result.dependencies).toHaveLength(1)
  })
})

describe('manifest-parser — cargo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('parses [dependencies] section', async () => {
    const toml = `[package]\nname = "myapp"\n\n[dependencies]\nserde = "1.0"\n`
    mockReadFile.mockResolvedValue(toml)
    const result = await parseManifest('Cargo.toml', 'cargo')
    const serde = result.dependencies.find((d) => d.name === 'serde')
    expect(serde?.versionRange).toBe('1.0')
    expect(serde?.isDev).toBe(false)
  })

  it('parses [dev-dependencies] as isDev: true', async () => {
    const toml = `[dev-dependencies]\nmockall = "0.11"\n`
    mockReadFile.mockResolvedValue(toml)
    const result = await parseManifest('Cargo.toml', 'cargo')
    const dep = result.dependencies.find((d) => d.name === 'mockall')
    expect(dep?.isDev).toBe(true)
  })

  it('extracts version from table syntax { version = "x" }', async () => {
    const toml = `[dependencies]\ntokio = { version = "1.28", features = ["full"] }\n`
    mockReadFile.mockResolvedValue(toml)
    const result = await parseManifest('Cargo.toml', 'cargo')
    const tokio = result.dependencies.find((d) => d.name === 'tokio')
    expect(tokio?.versionRange).toBe('1.28')
  })
})
