import { Hono } from 'hono'
import { db } from '@depgraph/db'
import { sql } from 'drizzle-orm'
import { ok, err } from '../lib/response'
import { loadPackageSubgraph, loadAdjacencyMap } from '@depgraph/crawler/src/graph/resolver'
import { getBlastRadius } from '@depgraph/crawler/src/graph/consumer-populator'
import { computeCentrality, findChokepoints } from '@depgraph/crawler/src/graph/traversal'

const router = new Hono()

// GET /graph/package/:packageId/subgraph
router.get('/package/:packageId/subgraph', async (c) => {
  const { packageId } = c.req.param()
  const depth = Math.min(Number(c.req.query('depth') ?? 3), 5)

  let subgraph: { map: import('@depgraph/crawler/src/graph/resolver').AdjacencyMap; nodes: Map<string, import('@depgraph/crawler/src/graph/resolver').GraphNode> }
  try {
    subgraph = await loadPackageSubgraph(db, packageId, depth)
  } catch {
    return err(c, 'Package not found or graph unavailable', 404, 'NOT_FOUND')
  }

  const { map, nodes } = subgraph

  const nodeList = Array.from(nodes.entries()).map(([id, n]) => ({
    id,
    name: n.name,
    ecosystem: n.ecosystem,
  }))

  const edges: Array<{ fromId: string; toId: string; depth: number }> = []
  let currentDepth = 1

  const visited = new Set<string>()
  const queue: Array<{ id: string; d: number }> = [{ id: packageId, d: 0 }]
  visited.add(packageId)

  while (queue.length > 0) {
    const item = queue.shift()!
    if (item.d >= depth) continue
    const neighbors = map.get(item.id) ?? []
    for (const neighborId of neighbors) {
      edges.push({ fromId: item.id, toId: neighborId, depth: item.d + 1 })
      if (!visited.has(neighborId)) {
        visited.add(neighborId)
        queue.push({ id: neighborId, d: item.d + 1 })
      }
    }
  }

  return ok(c, { nodes: nodeList, edges })
})

// GET /graph/package/:packageId/blast-radius
router.get('/package/:packageId/blast-radius', async (c) => {
  const { packageId } = c.req.param()
  const radius = await getBlastRadius(db, packageId)
  return ok(c, radius)
})

// GET /graph/chokepoints
router.get('/chokepoints', async (c) => {
  const ecosystem = c.req.query('ecosystem') as 'npm' | 'pypi' | 'cargo' | undefined
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)

  const { map, nodes } = await loadAdjacencyMap(db, { ecosystem })
  const centrality = computeCentrality(map)
  const chokepoints = findChokepoints(centrality, limit)

  const result = chokepoints.map((cp) => {
    const node = nodes.get(cp.packageId)
    return {
      packageId: cp.packageId,
      name: node?.name ?? cp.packageId,
      ecosystem: node?.ecosystem,
      centralityScore: cp.centralityScore,
    }
  })

  return ok(c, result)
})

export { router as graphRouter }
