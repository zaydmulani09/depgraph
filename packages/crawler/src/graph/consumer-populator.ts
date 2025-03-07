import { sql } from 'drizzle-orm'

interface DepEdgeRow {
  from_version_id: string
  to_package_id: string
  from_package_id: string
}

interface ConsumerTuple {
  package_id: string
  consumer_version_id: string
  depth: number
}

export async function populateConsumerEdges(
  db: any,
  options?: {
    packageIds?: string[]
    batchSize?: number
  }
): Promise<{ edgesWritten: number; packagesProcessed: number }> {
  const batchSize = options?.batchSize ?? 500

  // Load all relevant dependency edges with from_package_id resolved via versions join
  let edgeQuery: string
  if (options?.packageIds?.length) {
    const ids = options.packageIds.map((id) => `'${id}'`).join(',')
    edgeQuery = `
      SELECT de.from_version_id, de.to_package_id, v.package_id AS from_package_id
      FROM dependency_edges de
      JOIN versions v ON v.id = de.from_version_id
      WHERE v.package_id = ANY(ARRAY[${ids}]::uuid[])
        OR de.to_package_id = ANY(ARRAY[${ids}]::uuid[])
    `
  } else {
    edgeQuery = `
      SELECT de.from_version_id, de.to_package_id, v.package_id AS from_package_id
      FROM dependency_edges de
      JOIN versions v ON v.id = de.from_version_id
    `
  }

  const edgeResult = await db.execute(sql.raw(edgeQuery))
  const edgeRows: DepEdgeRow[] = (edgeResult.rows ?? edgeResult) as DepEdgeRow[]

  // Build in-memory lookup maps
  // packageId → [version_ids that directly depend on it]
  const directConsumers = new Map<string, string[]>()
  // version_id → package_id
  const versionToPackage = new Map<string, string>()

  for (const row of edgeRows) {
    if (!directConsumers.has(row.to_package_id)) {
      directConsumers.set(row.to_package_id, [])
    }
    directConsumers.get(row.to_package_id)!.push(row.from_version_id)
    versionToPackage.set(row.from_version_id, row.from_package_id)
  }

  const targetPackages = [...directConsumers.keys()]
  let edgesWritten = 0
  let packagesProcessed = 0

  // Process target packages in batches
  for (let batchStart = 0; batchStart < targetPackages.length; batchStart += batchSize) {
    const batch = targetPackages.slice(batchStart, batchStart + batchSize)
    const tuples: ConsumerTuple[] = []

    for (const targetPkg of batch) {
      // BFS: frontier = packages at current level
      let frontier: string[] = [targetPkg]
      const visitedPackages = new Set<string>([targetPkg])
      const visitedVersions = new Set<string>()

      for (let depth = 1; depth <= 5 && frontier.length > 0; depth++) {
        const nextFrontier: string[] = []

        for (const pkg of frontier) {
          const consumerVersions = directConsumers.get(pkg) ?? []
          for (const vId of consumerVersions) {
            if (!visitedVersions.has(vId)) {
              visitedVersions.add(vId)
              tuples.push({ package_id: targetPkg, consumer_version_id: vId, depth })

              const consumerPkg = versionToPackage.get(vId)
              if (consumerPkg && !visitedPackages.has(consumerPkg)) {
                visitedPackages.add(consumerPkg)
                nextFrontier.push(consumerPkg)
              }
            }
          }
        }

        frontier = nextFrontier
      }

      packagesProcessed++
    }

    // Upsert tuples in sub-batches to avoid hitting query size limits
    const subBatch = 200
    for (let i = 0; i < tuples.length; i += subBatch) {
      const chunk = tuples.slice(i, i + subBatch)
      if (chunk.length === 0) continue

      const values = chunk
        .map((t) => `('${t.package_id}', '${t.consumer_version_id}', ${t.depth})`)
        .join(',\n')

      await db.execute(sql.raw(`
        INSERT INTO consumer_edges (package_id, consumer_version_id, depth)
        VALUES ${values}
        ON CONFLICT (package_id, consumer_version_id) DO UPDATE SET depth = EXCLUDED.depth
      `))

      edgesWritten += chunk.length
    }
  }

  return { edgesWritten, packagesProcessed }
}

export async function getBlastRadius(
  db: any,
  packageId: string
): Promise<{
  directConsumers: number
  transitiveConsumers: number
  maxDepth: number
  topConsumers: Array<{ packageId: string; packageName: string; depth: number }>
}> {
  const countsResult = await db.execute(sql.raw(`
    SELECT
      COUNT(*) FILTER (WHERE depth = 1)::int AS direct_consumers,
      COUNT(*)::int AS transitive_consumers,
      COALESCE(MAX(depth), 0)::int AS max_depth
    FROM consumer_edges
    WHERE package_id = '${packageId}'
  `))

  const counts = ((countsResult.rows ?? countsResult) as any[])[0] ?? {
    direct_consumers: 0,
    transitive_consumers: 0,
    max_depth: 0,
  }

  const topResult = await db.execute(sql.raw(`
    SELECT v.package_id AS pkg_id, p.name AS pkg_name, MIN(ce.depth) AS min_depth
    FROM consumer_edges ce
    JOIN versions v ON v.id = ce.consumer_version_id
    JOIN packages p ON p.id = v.package_id
    WHERE ce.package_id = '${packageId}'
    GROUP BY v.package_id, p.name
    ORDER BY min_depth ASC
    LIMIT 10
  `))

  const topRows = (topResult.rows ?? topResult) as Array<{
    pkg_id: string
    pkg_name: string
    min_depth: number
  }>

  return {
    directConsumers: counts.direct_consumers ?? 0,
    transitiveConsumers: counts.transitive_consumers ?? 0,
    maxDepth: counts.max_depth ?? 0,
    topConsumers: topRows.map((r) => ({
      packageId: r.pkg_id,
      packageName: r.pkg_name,
      depth: r.min_depth,
    })),
  }
}
