import { readFile } from 'node:fs/promises'

export interface ParsedDependency {
  name: string
  versionRange: string
  isDev: boolean
}

export interface ParsedManifest {
  ecosystem: 'npm' | 'pypi' | 'cargo'
  dependencies: ParsedDependency[]
  rawContent: string
}

export async function parseManifest(
  filePath: string,
  ecosystem: 'npm' | 'pypi' | 'cargo'
): Promise<ParsedManifest> {
  const rawContent = await readFile(filePath, 'utf-8')

  switch (ecosystem) {
    case 'npm':
      return { ecosystem, dependencies: parseNpm(rawContent), rawContent }
    case 'pypi':
      return { ecosystem, dependencies: parsePypi(rawContent), rawContent }
    case 'cargo':
      return { ecosystem, dependencies: parseCargo(rawContent), rawContent }
  }
}

function parseNpm(content: string): ParsedDependency[] {
  const pkg = JSON.parse(content) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }

  const deps: ParsedDependency[] = []

  for (const [name, versionRange] of Object.entries(pkg.dependencies ?? {})) {
    deps.push({ name, versionRange, isDev: false })
  }
  for (const [name, versionRange] of Object.entries(pkg.devDependencies ?? {})) {
    deps.push({ name, versionRange, isDev: true })
  }

  return deps
}

const PYPI_OPERATORS = ['~=', '==', '>=', '<=', '!=', '>', '<'] as const

function parsePypi(content: string): ParsedDependency[] {
  const deps: ParsedDependency[] = []

  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('-r')) {
      console.warn(`[depgraph] manifest-parser: skipping recursive include: ${line}`)
      continue
    }

    let name = line
    let versionRange = '*'

    for (const op of PYPI_OPERATORS) {
      const idx = line.indexOf(op)
      if (idx !== -1) {
        name = line.slice(0, idx).trim()
        versionRange = line.slice(idx).trim()
        break
      }
    }

    // Strip extras e.g. requests[security] → requests
    name = name.replace(/\[.*?\]/, '').trim()
    if (!name) continue

    deps.push({ name, versionRange, isDev: false })
  }

  return deps
}

function parseCargoSection(content: string, section: string): Record<string, string> {
  const result: Record<string, string> = {}
  const lines = content.split('\n')
  let inSection = false

  for (const raw of lines) {
    const line = raw.trim()

    if (line.startsWith('[')) {
      // Normalize header by removing spaces
      const header = line.replace(/\s/g, '')
      if (header === `[${section}]`) {
        inSection = true
        continue
      } else if (inSection) {
        break
      }
      continue
    }

    if (!inSection || !line || line.startsWith('#')) continue

    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue

    const key = line.slice(0, eqIdx).trim()
    const valuePart = line.slice(eqIdx + 1).trim()

    let version = '*'
    if (valuePart.startsWith('"')) {
      version = valuePart.replace(/"/g, '').trim()
    } else if (valuePart.startsWith('{')) {
      const match = valuePart.match(/version\s*=\s*"([^"]+)"/)
      if (match) version = match[1]!
    }

    result[key] = version
  }

  return result
}

function parseCargo(content: string): ParsedDependency[] {
  const deps: ParsedDependency[] = []

  const prodDeps = parseCargoSection(content, 'dependencies')
  for (const [name, versionRange] of Object.entries(prodDeps)) {
    deps.push({ name, versionRange, isDev: false })
  }

  const devDeps = parseCargoSection(content, 'dev-dependencies')
  for (const [name, versionRange] of Object.entries(devDeps)) {
    deps.push({ name, versionRange, isDev: true })
  }

  return deps
}
