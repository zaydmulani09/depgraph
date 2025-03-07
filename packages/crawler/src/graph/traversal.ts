// Pure in-memory graph traversal — zero DB dependencies

export interface GraphNode {
  id: string
  name: string
  ecosystem: string
}

export interface GraphEdge {
  fromId: string
  toId: string
  depth: number
}

export interface AdjacencyMap {
  // packageId → array of dependency package ids (direct deps)
  forward: Map<string, string[]>
  // packageId → array of consumer package ids (who depends on this)
  reverse: Map<string, string[]>
}

export function buildAdjacencyMap(
  edges: Array<{ fromPackageId: string; toPackageId: string }>
): AdjacencyMap {
  const forward = new Map<string, string[]>()
  const reverse = new Map<string, string[]>()

  for (const { fromPackageId, toPackageId } of edges) {
    if (!forward.has(fromPackageId)) forward.set(fromPackageId, [])
    forward.get(fromPackageId)!.push(toPackageId)

    if (!reverse.has(toPackageId)) reverse.set(toPackageId, [])
    reverse.get(toPackageId)!.push(fromPackageId)
  }

  return { forward, reverse }
}

export function bfsDescendants(
  map: AdjacencyMap,
  startId: string,
  maxDepth = 10
): Map<string, number> {
  const result = new Map<string, number>()
  const visited = new Set<string>([startId])
  const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }]

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (depth >= maxDepth) continue

    for (const neighbor of map.forward.get(id) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        result.set(neighbor, depth + 1)
        queue.push({ id: neighbor, depth: depth + 1 })
      }
    }
  }

  return result
}

export function bfsAncestors(
  map: AdjacencyMap,
  startId: string,
  maxDepth = 10
): Map<string, number> {
  const result = new Map<string, number>()
  const visited = new Set<string>([startId])
  const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }]

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (depth >= maxDepth) continue

    for (const neighbor of map.reverse.get(id) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        result.set(neighbor, depth + 1)
        queue.push({ id: neighbor, depth: depth + 1 })
      }
    }
  }

  return result
}

export function shortestPath(
  map: AdjacencyMap,
  fromId: string,
  toId: string
): string[] | null {
  if (fromId === toId) return [fromId]

  const visited = new Set<string>([fromId])
  const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }]

  while (queue.length > 0) {
    const { id, path } = queue.shift()!

    for (const neighbor of map.forward.get(id) ?? []) {
      if (neighbor === toId) return [...path, neighbor]
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push({ id: neighbor, path: [...path, neighbor] })
      }
    }
  }

  return null
}

export function detectCycles(map: AdjacencyMap): string[][] {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const inStack = new Set<string>()

  const allNodes = new Set<string>()
  for (const [from, tos] of map.forward) {
    allNodes.add(from)
    for (const to of tos) allNodes.add(to)
  }
  for (const [from, tos] of map.reverse) {
    allNodes.add(from)
    for (const to of tos) allNodes.add(to)
  }

  function dfs(nodeId: string, path: string[]): void {
    visited.add(nodeId)
    inStack.add(nodeId)
    path.push(nodeId)

    for (const neighbor of map.forward.get(nodeId) ?? []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, path)
      } else if (inStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor)
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart))
        }
      }
    }

    inStack.delete(nodeId)
    path.pop()
  }

  for (const node of allNodes) {
    if (!visited.has(node)) {
      dfs(node, [])
    }
  }

  return cycles
}

export function computeCentrality(
  map: AdjacencyMap,
  nodeIds: string[]
): Map<string, number> {
  const scores = new Map<string, number>()
  for (const id of nodeIds) scores.set(id, 0)

  // Build candidate pairs from nodeIds
  const sampleSource =
    nodeIds.length > 15
      ? [...nodeIds].sort(() => Math.random() - 0.5).slice(0, 15)
      : nodeIds

  const allPairs: Array<[string, string]> = []
  for (let i = 0; i < sampleSource.length; i++) {
    for (let j = 0; j < sampleSource.length; j++) {
      if (i !== j) allPairs.push([sampleSource[i], sampleSource[j]])
    }
  }

  const sampledPairs =
    allPairs.length > 100
      ? allPairs.sort(() => Math.random() - 0.5).slice(0, 100)
      : allPairs

  let totalPaths = 0
  for (const [s, t] of sampledPairs) {
    const path = shortestPath(map, s, t)
    if (path === null || path.length <= 2) continue
    totalPaths++
    for (let k = 1; k < path.length - 1; k++) {
      const node = path[k]
      if (scores.has(node)) {
        scores.set(node, (scores.get(node) ?? 0) + 1)
      }
    }
  }

  if (totalPaths > 0) {
    for (const [id, score] of scores) {
      scores.set(id, score / totalPaths)
    }
  }

  return scores
}

export function findChokepoints(
  map: AdjacencyMap,
  nodeIds: string[],
  threshold = 0.1
): string[] {
  const centrality = computeCentrality(map, nodeIds)
  return nodeIds.filter((id) => (centrality.get(id) ?? 0) > threshold)
}
