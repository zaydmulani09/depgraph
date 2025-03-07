import { describe, it, expect, vi } from 'vitest'
import { getBlastRadius } from './consumer-populator'

function makeMockDb(rows: Record<string, unknown>[][], topRows: Record<string, unknown>[]) {
  let call = 0
  return {
    execute: vi.fn(async () => {
      const result = call === 0 ? rows[0] : topRows
      call++
      return result
    }),
  }
}

describe('getBlastRadius', () => {
  it('returns correct shape with mock data', async () => {
    const countRow = [{ direct_consumers: 3, transitive_consumers: 10, max_depth: 4 }]
    const topRow = [
      { pkg_id: 'pkg-1', pkg_name: 'express', min_depth: 1 },
      { pkg_id: 'pkg-2', pkg_name: 'lodash', min_depth: 2 },
    ]
    const db = makeMockDb([countRow], topRow)

    const result = await getBlastRadius(db as any, 'some-package-id')

    expect(result).toHaveProperty('directConsumers')
    expect(result).toHaveProperty('transitiveConsumers')
    expect(result).toHaveProperty('maxDepth')
    expect(result).toHaveProperty('topConsumers')
    expect(result.directConsumers).toBe(3)
    expect(result.transitiveConsumers).toBe(10)
    expect(result.maxDepth).toBe(4)
  })

  it('topConsumers array has at most 10 items', async () => {
    const countRow = [{ direct_consumers: 50, transitive_consumers: 200, max_depth: 5 }]
    // Simulate DB already applying LIMIT 10 — resolver returns at most 10 rows
    const topRow = Array.from({ length: 10 }, (_, i) => ({
      pkg_id: `pkg-${i}`,
      pkg_name: `package-${i}`,
      min_depth: 1,
    }))
    const db = makeMockDb([countRow], topRow)

    const result = await getBlastRadius(db as any, 'some-package-id')

    expect(result.topConsumers.length).toBeLessThanOrEqual(10)
  })

  it('returns zeros when package has no consumers', async () => {
    const countRow = [{ direct_consumers: 0, transitive_consumers: 0, max_depth: 0 }]
    const db = makeMockDb([countRow], [])

    const result = await getBlastRadius(db as any, 'lonely-package-id')

    expect(result.directConsumers).toBe(0)
    expect(result.transitiveConsumers).toBe(0)
    expect(result.maxDepth).toBe(0)
    expect(result.topConsumers).toEqual([])
  })

  it('topConsumers items have packageId, packageName, depth fields', async () => {
    const countRow = [{ direct_consumers: 1, transitive_consumers: 1, max_depth: 1 }]
    const topRow = [{ pkg_id: 'abc', pkg_name: 'react', min_depth: 1 }]
    const db = makeMockDb([countRow], topRow)

    const result = await getBlastRadius(db as any, 'pkg')

    expect(result.topConsumers[0]).toMatchObject({
      packageId: 'abc',
      packageName: 'react',
      depth: 1,
    })
  })
})
