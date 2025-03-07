import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import { populateConsumerEdges } from '../graph/consumer-populator'
import { loadAdjacencyMap } from '../graph/resolver'
import { computeCentrality, findChokepoints } from '../graph/traversal'

const PREFIX = '[graph-populate]'

interface GraphPopulateJobData {
  packageIds?: string[]
  full?: boolean
}

export function createGraphPopulateWorker(deps: { redis: Redis; db: any }): Worker {
  const { redis, db } = deps

  return new Worker(
    'graph-populate',
    async (job) => {
      const { packageIds, full } = job.data as GraphPopulateJobData

      let populateResult: { edgesWritten: number; packagesProcessed: number }

      if (full === true) {
        console.log(`${PREFIX} Starting full consumer edge recompute`)
        populateResult = await populateConsumerEdges(db)
      } else if (packageIds?.length) {
        console.log(`${PREFIX} Incremental update for ${packageIds.length} package(s)`)
        populateResult = await populateConsumerEdges(db, { packageIds })
      } else {
        console.log(`${PREFIX} No target specified — skipping`)
        return { edgesWritten: 0, packagesProcessed: 0, chokepointCount: 0, topChokepoints: [] }
      }

      console.log(
        `${PREFIX} Consumer edges written: ${populateResult.edgesWritten}, packages processed: ${populateResult.packagesProcessed}`
      )

      // Load adjacency map and compute centrality
      const { map, nodes } = await loadAdjacencyMap(db)
      const nodeIds = [...nodes.keys()]

      const chokepointIds = findChokepoints(map, nodeIds, 0.1)
      const centrality = computeCentrality(map, nodeIds)

      const topChokepoints = chokepointIds
        .map((id) => ({ id, name: nodes.get(id)?.name ?? id, score: centrality.get(id) ?? 0 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

      console.log(
        `${PREFIX} Total nodes: ${nodeIds.length}, total edges: ${[...map.forward.values()].reduce((sum, arr) => sum + arr.length, 0)}, chokepoints: ${chokepointIds.length}`
      )
      if (topChokepoints.length > 0) {
        console.log(`${PREFIX} Top chokepoints:`, topChokepoints.map((c) => `${c.name} (${c.score.toFixed(3)})`).join(', '))
      }

      return {
        edgesWritten: populateResult.edgesWritten,
        packagesProcessed: populateResult.packagesProcessed,
        chokepointCount: chokepointIds.length,
        topChokepoints,
      }
    },
    { connection: redis }
  )
}
