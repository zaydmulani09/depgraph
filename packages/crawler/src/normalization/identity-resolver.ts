import { sql } from 'drizzle-orm'
import { packages } from '@depgraph/db'
import type { db as DbType } from '@depgraph/db'
import type { Ecosystem } from './adapter'

export interface PackageIdentityMatch {
  ecosystemA: Ecosystem
  nameA: string
  ecosystemB: Ecosystem
  nameB: string
  confidence: number
  matchReason: string[]
}

const STRIP_PREFIXES = ['python-', 'py-', 'node-', 'js-', 'rust-']

function stripEcoPrefixes(name: string): string {
  let n = name.toLowerCase()
  for (const p of STRIP_PREFIXES) {
    if (n.startsWith(p)) { n = n.slice(p.length); break }
  }
  return n
}

export async function findCrossEcosystemMatches(
  db: typeof DbType,
  options?: { minConfidence?: number; limit?: number }
): Promise<PackageIdentityMatch[]> {
  const minConfidence = options?.minConfidence ?? 0.7
  const limit = options?.limit ?? 100

  const matchMap = new Map<string, PackageIdentityMatch>()

  function upsert(
    ecosystemA: Ecosystem, nameA: string,
    ecosystemB: Ecosystem, nameB: string,
    delta: number, reason: string
  ) {
    const [eA, nA, eB, nB] = ecosystemA < ecosystemB
      ? [ecosystemA, nameA, ecosystemB, nameB]
      : [ecosystemB, nameB, ecosystemA, nameA]
    const key = `${eA}:${nA}|${eB}:${nB}`
    const m = matchMap.get(key) ?? { ecosystemA: eA, nameA: nA, ecosystemB: eB, nameB: nB, confidence: 0, matchReason: [] }
    m.confidence = Math.min(1, m.confidence + delta)
    if (!m.matchReason.includes(reason)) m.matchReason.push(reason)
    matchMap.set(key, m)
  }

  // Signal 1: Same repository URL (0.6)
  try {
    const rows = await db.execute(sql`
      SELECT a.ecosystem as ea, a.name as na, b.ecosystem as eb, b.name as nb
      FROM packages a
      JOIN packages b ON a.repository_url = b.repository_url
        AND a.ecosystem != b.ecosystem
        AND a.repository_url IS NOT NULL
        AND a.ecosystem < b.ecosystem
      LIMIT ${sql.raw(String(limit * 3))}
    `)
    for (const row of (rows.rows ?? rows) as Array<Record<string, string>>) {
      upsert(row['ea'] as Ecosystem, row['na'], row['eb'] as Ecosystem, row['nb'], 0.6, 'same_repository_url')
    }
  } catch { /* DB may be empty in tests */ }

  // Signal 2: Exact name match across ecosystems (0.3)
  try {
    const rows = await db.execute(sql`
      SELECT a.ecosystem as ea, a.name as na, b.ecosystem as eb, b.name as nb
      FROM packages a
      JOIN packages b ON lower(a.name) = lower(b.name)
        AND a.ecosystem != b.ecosystem
        AND a.ecosystem < b.ecosystem
      LIMIT ${sql.raw(String(limit * 3))}
    `)
    for (const row of (rows.rows ?? rows) as Array<Record<string, string>>) {
      upsert(row['ea'] as Ecosystem, row['na'], row['eb'] as Ecosystem, row['nb'], 0.3, 'exact_name_match')
    }
  } catch { /* DB may be empty */ }

  // Signal 3: Similar name via prefix stripping (0.1) — only when both repo URLs null
  try {
    const allPkgs = await db.select({
      ecosystem: packages.ecosystem,
      name: packages.name,
      repositoryUrl: packages.repository_url,
    }).from(packages)

    const byStripped = new Map<string, Array<{ ecosystem: string; name: string; repositoryUrl: string | null }>>()
    for (const pkg of allPkgs) {
      const stripped = stripEcoPrefixes(pkg.name)
      const arr = byStripped.get(stripped) ?? []
      arr.push(pkg)
      byStripped.set(stripped, arr)
    }

    for (const [, pkgs] of byStripped) {
      if (pkgs.length < 2) continue
      for (let i = 0; i < pkgs.length; i++) {
        for (let j = i + 1; j < pkgs.length; j++) {
          const a = pkgs[i], b = pkgs[j]
          if (a.ecosystem === b.ecosystem) continue
          if (a.repositoryUrl !== null || b.repositoryUrl !== null) continue
          upsert(a.ecosystem as Ecosystem, a.name, b.ecosystem as Ecosystem, b.name, 0.1, 'similar_name')
        }
      }
    }
  } catch { /* DB may be empty */ }

  return Array.from(matchMap.values())
    .filter((m) => m.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit)
}

export async function getPackageIdentityMap(
  db: typeof DbType
): Promise<Map<string, string[]>> {
  const matches = await findCrossEcosystemMatches(db)
  const map = new Map<string, string[]>()

  for (const m of matches) {
    const keyA = `${m.ecosystemA}:${m.nameA}`
    const keyB = `${m.ecosystemB}:${m.nameB}`

    if (!map.has(keyA)) map.set(keyA, [keyA])
    if (!map.has(keyB)) map.set(keyB, [keyB])

    const groupA = map.get(keyA)!
    const groupB = map.get(keyB)!
    if (!groupA.includes(keyB)) groupA.push(keyB)
    if (!groupB.includes(keyA)) groupB.push(keyA)
  }

  return map
}
