import { sql } from 'drizzle-orm'
import { buildAdjacencyMap } from './traversal'
import type { AdjacencyMap, GraphNode } from './traversal'

export type { AdjacencyMap, GraphNode }

interface EdgeRow {
  from_package_id: string
  to_package_id: string
}

interface PackageRow {
  id: string
  name: string
  ecosystem: string
}

export async function loadAdjacencyMap(
  db: any,
  options?: {
    ecosystem?: 'npm' | 'pypi' | 'cargo'
    packageIds?: string[]
    maxNodes?: number
  }
): Promise<{ map: AdjacencyMap; nodes: Map<string, GraphNode> }> {
  const maxNodes = options?.maxNodes ?? 5000

  let query: string
  const params: unknown[] = []

  if (options?.ecosystem && options?.packageIds?.length) {
    query = `
      SELECT v.package_id AS from_package_id, de.to_package_id
      FROM dependency_edges de
      JOIN versions v ON v.id = de.from_version_id
      JOIN packages p_from ON p_from.id = v.package_id
      JOIN packages p_to ON p_to.id = de.to_package_id
      WHERE p_from.ecosystem = $1 AND p_to.ecosystem = $1
        AND (v.package_id = ANY($2::uuid[]) OR de.to_package_id = ANY($2::uuid[]))
    `
    params.push(options.ecosystem, options.packageIds)
  } else if (options?.ecosystem) {
    query = `
      SELECT v.package_id AS from_package_id, de.to_package_id
      FROM dependency_edges de
      JOIN versions v ON v.id = de.from_version_id
      JOIN packages p_from ON p_from.id = v.package_id
      JOIN packages p_to ON p_to.id = de.to_package_id
      WHERE p_from.ecosystem = $1 AND p_to.ecosystem = $1
    `
    params.push(options.ecosystem)
  } else if (options?.packageIds?.length) {
    query = `
      SELECT v.package_id AS from_package_id, de.to_package_id
      FROM dependency_edges de
      JOIN versions v ON v.id = de.from_version_id
      WHERE v.package_id = ANY($1::uuid[]) OR de.to_package_id = ANY($1::uuid[])
    `
    params.push(options.packageIds)
  } else {
    query = `
      SELECT v.package_id AS from_package_id, de.to_package_id
      FROM dependency_edges de
      JOIN versions v ON v.id = de.from_version_id
    `
  }

  const result = await db.execute(sql.raw(buildParameterizedQuery(query, params)))
  const edgeRows: EdgeRow[] = (result.rows ?? result) as EdgeRow[]

  // Collect all unique package ids
  const packageIdSet = new Set<string>()
  for (const row of edgeRows) {
    packageIdSet.add(row.from_package_id)
    packageIdSet.add(row.to_package_id)
  }

  if (packageIdSet.size > maxNodes) {
    console.warn(
      `[resolver] loadAdjacencyMap: result has ${packageIdSet.size} nodes, truncating to ${maxNodes}`
    )
    // Truncate by limiting edges to first maxNodes unique packages
    const allowedIds = new Set([...packageIdSet].slice(0, maxNodes))
    const truncated = edgeRows.filter(
      (r) => allowedIds.has(r.from_package_id) && allowedIds.has(r.to_package_id)
    )
    return buildResult(db, truncated, allowedIds)
  }

  return buildResult(db, edgeRows, packageIdSet)
}

async function buildResult(
  db: any,
  edgeRows: EdgeRow[],
  packageIdSet: Set<string>
): Promise<{ map: AdjacencyMap; nodes: Map<string, GraphNode> }> {
  const edges = edgeRows.map((r) => ({
    fromPackageId: r.from_package_id,
    toPackageId: r.to_package_id,
  }))

  const map = buildAdjacencyMap(edges)

  const nodes = new Map<string, GraphNode>()
  if (packageIdSet.size === 0) return { map, nodes }

  const ids = [...packageIdSet]
  const pkgResult = await db.execute(
    sql.raw(
      `SELECT id, name, ecosystem FROM packages WHERE id = ANY(ARRAY[${ids.map((id) => `'${id}'`).join(',')}]::uuid[])`
    )
  )
  const pkgRows: PackageRow[] = (pkgResult.rows ?? pkgResult) as PackageRow[]

  for (const row of pkgRows) {
    nodes.set(row.id, { id: row.id, name: row.name, ecosystem: row.ecosystem })
  }

  return { map, nodes }
}

export async function loadPackageSubgraph(
  db: any,
  packageId: string,
  depth = 3
): Promise<{ map: AdjacencyMap; nodes: Map<string, GraphNode> }> {
  // Load forward and reverse edges up to `depth` hops
  const result = await db.execute(
    sql.raw(`
      WITH RECURSIVE forward_graph AS (
        SELECT v.package_id AS from_pkg, de.to_package_id AS to_pkg, 1 AS depth
        FROM dependency_edges de
        JOIN versions v ON v.id = de.from_version_id
        WHERE v.package_id = '${packageId}'
        UNION
        SELECT v2.package_id, de2.to_package_id, fg.depth + 1
        FROM dependency_edges de2
        JOIN versions v2 ON v2.id = de2.from_version_id
        JOIN forward_graph fg ON fg.to_pkg = v2.package_id
        WHERE fg.depth < ${depth}
      ),
      reverse_graph AS (
        SELECT v.package_id AS from_pkg, de.to_package_id AS to_pkg, 1 AS depth
        FROM dependency_edges de
        JOIN versions v ON v.id = de.from_version_id
        WHERE de.to_package_id = '${packageId}'
        UNION
        SELECT v2.package_id, de2.to_package_id, rg.depth + 1
        FROM dependency_edges de2
        JOIN versions v2 ON v2.id = de2.from_version_id
        JOIN reverse_graph rg ON rg.from_pkg = de2.to_package_id
        WHERE rg.depth < ${depth}
      )
      SELECT from_pkg AS from_package_id, to_pkg AS to_package_id FROM forward_graph
      UNION
      SELECT from_pkg AS from_package_id, to_pkg AS to_package_id FROM reverse_graph
    `)
  )

  const edgeRows: EdgeRow[] = (result.rows ?? result) as EdgeRow[]

  const packageIdSet = new Set<string>([packageId])
  for (const row of edgeRows) {
    packageIdSet.add(row.from_package_id)
    packageIdSet.add(row.to_package_id)
  }

  return buildResult(db, edgeRows, packageIdSet)
}

// Build a parameterized query string by inlining parameters
// (safe only for internal server-side use with trusted input)
function buildParameterizedQuery(query: string, params: unknown[]): string {
  let result = query
  for (let i = 0; i < params.length; i++) {
    const param = params[i]
    let value: string
    if (Array.isArray(param)) {
      value = `ARRAY[${param.map((p) => `'${String(p)}'`).join(',')}]::uuid[]`
    } else {
      value = `'${String(param)}'`
    }
    result = result.replace(`$${i + 1}`, value)
  }
  return result
}
