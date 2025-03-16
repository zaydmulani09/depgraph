import { describe, it, expect, vi } from 'vitest'
import { computeTransitiveDiff } from './transitive-diff'

// fromVersionId deps: express@^4.18.0, lodash@^4.17.21, axios@^1.0.0
// toVersionId deps:   express@^4.19.0, zod@^3.0.0, axios@^1.0.0
const FROM_ROWS = [
  { to_package_id: 'pkg-express', name: 'express', ecosystem: 'npm', version: '^4.18.0' },
  { to_package_id: 'pkg-lodash', name: 'lodash', ecosystem: 'npm', version: '^4.17.21' },
  { to_package_id: 'pkg-axios', name: 'axios', ecosystem: 'npm', version: '^1.0.0' },
]
const TO_ROWS = [
  { to_package_id: 'pkg-express', name: 'express', ecosystem: 'npm', version: '^4.19.0' },
  { to_package_id: 'pkg-zod', name: 'zod', ecosystem: 'npm', version: '^3.0.0' },
  { to_package_id: 'pkg-axios', name: 'axios', ecosystem: 'npm', version: '^1.0.0' },
]

function makeMockDb(fromRows: unknown[], toRows: unknown[]) {
  let call = 0
  return {
    execute: vi.fn(async () => {
      const rows = call === 0 ? fromRows : toRows
      call++
      return rows
    }),
  }
}

describe('computeTransitiveDiff', () => {
  it('zod appears as added (in to but not from)', async () => {
    const db = makeMockDb(FROM_ROWS, TO_ROWS)
    const diffs = await computeTransitiveDiff(db as any, 'pkg-parent', 'ver-1', 'ver-2')
    const added = diffs.find((d) => d.packageId === 'pkg-zod')
    expect(added).toBeDefined()
    expect(added!.changeType).toBe('added')
    expect(added!.fromVersion).toBeNull()
    expect(added!.toVersion).toBe('^3.0.0')
  })

  it('lodash appears as removed (in from but not to)', async () => {
    const db = makeMockDb(FROM_ROWS, TO_ROWS)
    const diffs = await computeTransitiveDiff(db as any, 'pkg-parent', 'ver-1', 'ver-2')
    const removed = diffs.find((d) => d.packageId === 'pkg-lodash')
    expect(removed).toBeDefined()
    expect(removed!.changeType).toBe('removed')
    expect(removed!.fromVersion).toBe('^4.17.21')
    expect(removed!.toVersion).toBeNull()
  })

  it('express appears as version_changed (same pkg, different range)', async () => {
    const db = makeMockDb(FROM_ROWS, TO_ROWS)
    const diffs = await computeTransitiveDiff(db as any, 'pkg-parent', 'ver-1', 'ver-2')
    const changed = diffs.find((d) => d.packageId === 'pkg-express')
    expect(changed).toBeDefined()
    expect(changed!.changeType).toBe('version_changed')
    expect(changed!.fromVersion).toBe('^4.18.0')
    expect(changed!.toVersion).toBe('^4.19.0')
  })

  it('axios NOT in diffs (same version in both)', async () => {
    const db = makeMockDb(FROM_ROWS, TO_ROWS)
    const diffs = await computeTransitiveDiff(db as any, 'pkg-parent', 'ver-1', 'ver-2')
    const axios = diffs.find((d) => d.packageId === 'pkg-axios')
    expect(axios).toBeUndefined()
  })

  it('null fromVersionId → all to deps are added', async () => {
    // fromVersionId=null skips first db.execute; toVersionId query is the only call
    const db = makeMockDb(TO_ROWS, [])
    const diffs = await computeTransitiveDiff(db as any, 'pkg-parent', null, 'ver-2')
    expect(diffs.every((d) => d.changeType === 'added')).toBe(true)
    expect(diffs.length).toBe(TO_ROWS.length)
  })

  it('depth is always 1 for all entries', async () => {
    const db = makeMockDb(FROM_ROWS, TO_ROWS)
    const diffs = await computeTransitiveDiff(db as any, 'pkg-parent', 'ver-1', 'ver-2')
    expect(diffs.every((d) => d.depth === 1)).toBe(true)
  })
})
