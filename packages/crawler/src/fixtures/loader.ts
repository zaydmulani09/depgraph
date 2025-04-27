import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export type FixtureEcosystem = 'npm' | 'pypi' | 'cargo'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function fixturePath(ecosystem: FixtureEcosystem, packageName: string): string {
  return path.resolve(__dirname, ecosystem, `${packageName}.json`)
}

export async function loadFixture(
  ecosystem: FixtureEcosystem,
  packageName: string
): Promise<unknown | null> {
  try {
    const raw = await readFile(fixturePath(ecosystem, packageName), 'utf-8')
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export async function listFixtures(ecosystem: FixtureEcosystem): Promise<string[]> {
  try {
    const dir = path.resolve(__dirname, ecosystem)
    const entries = await readdir(dir)
    return entries
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5))
  } catch {
    return []
  }
}

export async function loadAllFixtures(): Promise<{
  npm: string[]
  pypi: string[]
  cargo: string[]
}> {
  const [npm, pypi, cargo] = await Promise.all([
    listFixtures('npm'),
    listFixtures('pypi'),
    listFixtures('cargo'),
  ])
  return { npm, pypi, cargo }
}
