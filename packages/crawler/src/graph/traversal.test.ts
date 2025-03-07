import { describe, it, expect } from 'vitest'
import {
  buildAdjacencyMap,
  bfsDescendants,
  bfsAncestors,
  shortestPath,
  detectCycles,
  findChokepoints,
  computeCentrality,
} from './traversal'

// Test graph:
//   A → B → D
//   A → C → D
//   B → E

const EDGES = [
  { fromPackageId: 'A', toPackageId: 'B' },
  { fromPackageId: 'A', toPackageId: 'C' },
  { fromPackageId: 'B', toPackageId: 'D' },
  { fromPackageId: 'C', toPackageId: 'D' },
  { fromPackageId: 'B', toPackageId: 'E' },
]

function makeMap() {
  return buildAdjacencyMap(EDGES)
}

describe('buildAdjacencyMap', () => {
  it('builds forward edges correctly', () => {
    const map = makeMap()
    expect(map.forward.get('A')).toEqual(expect.arrayContaining(['B', 'C']))
    expect(map.forward.get('B')).toEqual(expect.arrayContaining(['D', 'E']))
    expect(map.forward.get('C')).toEqual(['D'])
  })

  it('builds reverse edges correctly', () => {
    const map = makeMap()
    expect(map.reverse.get('D')).toEqual(expect.arrayContaining(['B', 'C']))
    expect(map.reverse.get('B')).toEqual(['A'])
    expect(map.reverse.get('E')).toEqual(['B'])
  })
})

describe('bfsDescendants', () => {
  it('returns correct depths from A', () => {
    const map = makeMap()
    const result = bfsDescendants(map, 'A')
    expect(result.get('B')).toBe(1)
    expect(result.get('C')).toBe(1)
    expect(result.get('D')).toBe(2)
    expect(result.get('E')).toBe(2)
    expect(result.has('A')).toBe(false)
  })

  it('returns empty map from D (no outgoing edges)', () => {
    const map = makeMap()
    const result = bfsDescendants(map, 'D')
    expect(result.size).toBe(0)
  })

  it('respects maxDepth', () => {
    const map = makeMap()
    const result = bfsDescendants(map, 'A', 1)
    expect(result.get('B')).toBe(1)
    expect(result.get('C')).toBe(1)
    expect(result.has('D')).toBe(false)
    expect(result.has('E')).toBe(false)
  })

  it('handles cycles without infinite loop', () => {
    const cycleMap = buildAdjacencyMap([
      { fromPackageId: 'X', toPackageId: 'Y' },
      { fromPackageId: 'Y', toPackageId: 'X' },
    ])
    const result = bfsDescendants(cycleMap, 'X')
    expect(result.get('Y')).toBe(1)
    expect(result.has('X')).toBe(false) // startId excluded
  })
})

describe('bfsAncestors', () => {
  it('returns correct depths from D', () => {
    const map = makeMap()
    const result = bfsAncestors(map, 'D')
    expect(result.get('B')).toBe(1)
    expect(result.get('C')).toBe(1)
    expect(result.get('A')).toBe(2)
    expect(result.has('D')).toBe(false)
  })

  it('returns empty map from A (no incoming edges)', () => {
    const map = makeMap()
    const result = bfsAncestors(map, 'A')
    expect(result.size).toBe(0)
  })
})

describe('shortestPath', () => {
  it('finds path from A to E', () => {
    const map = makeMap()
    const path = shortestPath(map, 'A', 'E')
    expect(path).toEqual(['A', 'B', 'E'])
  })

  it('finds a valid length-3 path from A to D', () => {
    const map = makeMap()
    const path = shortestPath(map, 'A', 'D')
    expect(path).not.toBeNull()
    expect(path!.length).toBe(3)
    expect(path![0]).toBe('A')
    expect(path![path!.length - 1]).toBe('D')
  })

  it('returns null for reverse path D to A', () => {
    const map = makeMap()
    const path = shortestPath(map, 'D', 'A')
    expect(path).toBeNull()
  })

  it('returns single-element path when from === to', () => {
    const map = makeMap()
    const path = shortestPath(map, 'A', 'A')
    expect(path).toEqual(['A'])
  })
})

describe('detectCycles', () => {
  it('returns empty array for a DAG', () => {
    const map = makeMap()
    const cycles = detectCycles(map)
    expect(cycles).toEqual([])
  })

  it('detects cycle B → C → B', () => {
    const cycleMap = buildAdjacencyMap([
      { fromPackageId: 'A', toPackageId: 'B' },
      { fromPackageId: 'B', toPackageId: 'C' },
      { fromPackageId: 'C', toPackageId: 'B' },
    ])
    const cycles = detectCycles(cycleMap)
    expect(cycles.length).toBeGreaterThan(0)
    const flatCycle = cycles[0]
    expect(flatCycle).toContain('B')
    expect(flatCycle).toContain('C')
  })
})

describe('findChokepoints', () => {
  it('returns node B as highest-centrality node (on path to E)', () => {
    const map = makeMap()
    const nodeIds = ['A', 'B', 'C', 'D', 'E']
    const centrality = computeCentrality(map, nodeIds)
    // B is always on A→E path (the only intermediate), so must have higher centrality than D or E
    expect(centrality.get('B')!).toBeGreaterThan(centrality.get('D') ?? 0)
    expect(centrality.get('B')!).toBeGreaterThan(centrality.get('E') ?? 0)
  })

  it('findChokepoints returns B as a chokepoint', () => {
    const map = makeMap()
    const nodeIds = ['A', 'B', 'C', 'D', 'E']
    const chokepoints = findChokepoints(map, nodeIds, 0.1)
    expect(chokepoints).toContain('B')
  })

  it('returns empty array when threshold is 1.0 (no node reaches 100%)', () => {
    const map = makeMap()
    const nodeIds = ['A', 'B', 'C', 'D', 'E']
    const chokepoints = findChokepoints(map, nodeIds, 1.0)
    expect(chokepoints).toEqual([])
  })
})
