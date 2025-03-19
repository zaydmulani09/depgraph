import { Hono } from 'hono'
import { db } from '@depgraph/db'
import { z } from 'zod'
import { ok, err, paginated } from '../lib/response'
import { parseQuery } from '../lib/validate'
import { listSnapshots, getSnapshot } from '@depgraph/crawler/src/snapshots/persister'
import { diffSnapshots } from '@depgraph/crawler/src/snapshots/differ'

const router = new Hono()

// GET /snapshots
router.get('/', async (c) => {
  const repositoryId = c.req.query('repositoryId')
  const limit = Math.min(Number(c.req.query('limit') ?? 10), 50)
  const snaps = await listSnapshots(db, { repositoryId, limit })
  return ok(c, snaps)
})

// GET /snapshots/:id
router.get('/:id', async (c) => {
  const { id } = c.req.param()
  const snap = await getSnapshot(db, id)
  if (!snap) return err(c, 'Snapshot not found', 404, 'NOT_FOUND')
  return ok(c, snap)
})

// GET /snapshots/:id/packages
const pkgQuerySchema = z.object({
  sort: z.enum(['composite_score_desc', 'name_asc']).default('composite_score_desc'),
  ecosystem: z.enum(['npm', 'pypi', 'cargo']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

router.get('/:id/packages', async (c) => {
  const { id } = c.req.param()
  const snap = await getSnapshot(db, id)
  if (!snap) return err(c, 'Snapshot not found', 404, 'NOT_FOUND')

  const parsed = parseQuery(c, pkgQuerySchema)
  if (!parsed.success) return parsed.response
  const { sort, ecosystem, page, limit } = parsed.data as z.infer<typeof pkgQuerySchema>

  let pkgs = snap.packages
  if (ecosystem) pkgs = pkgs.filter((p) => p.ecosystem === ecosystem)
  if (sort === 'name_asc') pkgs = pkgs.sort((a, b) => a.packageName.localeCompare(b.packageName))
  else pkgs = pkgs.sort((a, b) => b.compositeScore - a.compositeScore)

  const total = pkgs.length
  const offset = (page - 1) * limit
  return paginated(c, pkgs.slice(offset, offset + limit), total, page, limit)
})

// POST /snapshots/diff
router.post('/diff', async (c) => {
  let body: { previousSnapshotId?: string; currentSnapshotId?: string }
  try {
    body = await c.req.json()
  } catch {
    return err(c, 'Invalid JSON body', 400, 'BAD_REQUEST')
  }

  const { previousSnapshotId, currentSnapshotId } = body
  if (!previousSnapshotId || !currentSnapshotId) {
    return err(c, 'previousSnapshotId and currentSnapshotId required', 400, 'VALIDATION_ERROR')
  }

  const [prev, curr] = await Promise.all([
    getSnapshot(db, previousSnapshotId),
    getSnapshot(db, currentSnapshotId),
  ])
  if (!prev) return err(c, 'Previous snapshot not found', 404, 'NOT_FOUND')
  if (!curr) return err(c, 'Current snapshot not found', 404, 'NOT_FOUND')

  const diff = diffSnapshots(prev, curr, previousSnapshotId, currentSnapshotId)
  return ok(c, diff)
})

export { router as snapshotsRouter }
