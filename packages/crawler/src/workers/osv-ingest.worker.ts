import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import { eq, and, sql } from 'drizzle-orm'
import type { db as DbType } from '@depgraph/db'
import { packages, advisories, advisoryAffectedVersions } from '@depgraph/db'
import type { OsvClient, OsvEcosystem } from '../integrations/osv/client'
import type { OsvSyncCursor } from '../integrations/osv/cursor'
import { normalizeOsvAdvisory } from '../integrations/osv/normalizer'
import { riskScoreQueue } from '../queue'

const PREFIX = '[osv-ingest]'

// Map depgraph ecosystem names → OSV ecosystem names
const ECOSYSTEM_MAP: Record<string, OsvEcosystem> = {
  npm: 'npm',
  pypi: 'PyPI',
  cargo: 'crates.io',
}

type OsvIngestJobPayload =
  | { mode: 'package'; packageName: string; ecosystem: OsvEcosystem; packageId: string }
  | { mode: 'sync'; ecosystem: OsvEcosystem }

interface OsvIngestDeps {
  redis: Redis
  osv: OsvClient
  cursor: OsvSyncCursor
  db: typeof DbType
}

export function createOsvIngestWorker(deps: OsvIngestDeps): Worker {
  const { redis, osv, cursor, db } = deps

  return new Worker(
    'osv-ingest',
    async (job) => {
      const payload = job.data as OsvIngestJobPayload

      if (payload.mode === 'package') {
        return handlePackageMode(payload, osv, db)
      } else {
        return handleSyncMode(payload, osv, cursor, db)
      }
    },
    { connection: redis }
  )
}

async function upsertAdvisory(
  db: typeof DbType,
  normalized: ReturnType<typeof normalizeOsvAdvisory>
): Promise<void> {
  await db.transaction(async (tx) => {
    const [adv] = await tx
      .insert(advisories)
      .values(normalized.advisory)
      .onConflictDoUpdate({
        target: advisories.osv_id,
        set: {
          severity: sql`excluded.severity`,
          cvss_score: sql`excluded.cvss_score`,
          modified_at: sql`excluded.modified_at`,
          withdrawn_at: sql`excluded.withdrawn_at`,
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          aliases: sql`excluded.aliases`,
        },
      })
      .returning({ id: advisories.id })

    for (const av of normalized.affected_versions) {
      await tx
        .insert(advisoryAffectedVersions)
        .values({ advisory_id: adv.id, ...av })
        .onConflictDoNothing()
    }
  })
}

async function handlePackageMode(
  payload: { mode: 'package'; packageName: string; ecosystem: OsvEcosystem; packageId: string },
  osv: OsvClient,
  db: typeof DbType
) {
  const { packageName, ecosystem, packageId } = payload
  console.log(`${PREFIX} [package] Querying OSV for ${ecosystem}:${packageName}`)

  const vulns = await osv.queryPackage(ecosystem, packageName)
  console.log(`${PREFIX} [package] Found ${vulns.length} advisories for ${packageName}`)

  let advisoriesWritten = 0
  for (const vuln of vulns) {
    try {
      const normalized = normalizeOsvAdvisory(vuln, packageId)
      await upsertAdvisory(db, normalized)
      advisoriesWritten++
    } catch (err) {
      console.warn(`${PREFIX} Failed to upsert advisory ${vuln.id}: ${err}`)
    }
  }

  // Enqueue risk scoring now that advisories are fresh
  await riskScoreQueue.add('score', { packageId })

  return { packageName, advisoriesFound: vulns.length, advisoriesWritten }
}

async function handleSyncMode(
  payload: { mode: 'sync'; ecosystem: OsvEcosystem },
  osv: OsvClient,
  cursor: OsvSyncCursor,
  db: typeof DbType
) {
  const { ecosystem } = payload
  const since = (await cursor.getLastSync(ecosystem)) ?? '2020-01-01T00:00:00Z'
  console.log(`${PREFIX} [sync] ${ecosystem} since ${since}`)

  const vulns = await osv.queryModifiedSince(ecosystem, since)
  console.log(`${PREFIX} [sync] ${ecosystem}: ${vulns.length} advisories modified since ${since}`)

  let advisoriesProcessed = 0
  let packagesMatched = 0

  for (const vuln of vulns) {
    // Find the affected package name for this ecosystem
    const affectedPkg = vuln.affected?.find(
      (a) => a.package.ecosystem === ecosystem || a.package.ecosystem === ECOSYSTEM_MAP[ecosystem]
    )
    if (!affectedPkg) continue

    const packageName = affectedPkg.package.name

    // Look up package in DB
    const dbEcosystem = Object.entries(ECOSYSTEM_MAP).find(([, v]) => v === ecosystem)?.[0] ?? ecosystem
    const [pkg] = await db
      .select({ id: packages.id })
      .from(packages)
      .where(
        and(
          eq(packages.name, packageName),
          eq(packages.ecosystem, dbEcosystem as 'npm' | 'pypi' | 'cargo')
        )
      )
      .limit(1)

    if (!pkg) continue // Only process packages we've crawled
    packagesMatched++

    try {
      const normalized = normalizeOsvAdvisory(vuln, pkg.id)
      await upsertAdvisory(db, normalized)
      advisoriesProcessed++
    } catch (err) {
      console.warn(`${PREFIX} Failed to upsert advisory ${vuln.id}: ${err}`)
    }
  }

  // Update cursor to now
  await cursor.setLastSync(ecosystem, new Date().toISOString())
  console.log(`${PREFIX} [sync] ${ecosystem}: processed ${advisoriesProcessed}, matched ${packagesMatched} packages`)

  return { ecosystem, advisoriesProcessed, packagesMatched }
}
