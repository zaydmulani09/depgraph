import { sql } from 'drizzle-orm'

export interface SignalDataPoint {
  value: number
  measured_at: Date
}

export interface SignalSeries {
  packageId: string
  signalName: string
  points: SignalDataPoint[]
}

type AnyDb = { execute: (q: unknown) => Promise<unknown> }

function toRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  const r = result as { rows?: T[] }
  return r.rows ?? []
}

// ─── Single package signal history ───────────────────────────────────────────

export async function getSignalHistory(
  db: AnyDb,
  packageId: string,
  signalName: string,
  limitDays = 90
): Promise<SignalSeries> {
  const cutoff = new Date(Date.now() - limitDays * 86400000)

  const result = await db.execute(sql`
    SELECT value, measured_at
    FROM signals
    WHERE package_id = ${packageId}::uuid
      AND signal_name = ${signalName}
      AND measured_at >= ${cutoff}
    ORDER BY measured_at ASC
  `)

  const rows = toRows<{ value: number; measured_at: Date }>(result)

  return {
    packageId,
    signalName,
    points: rows.map((r) => ({
      value: Number(r.value),
      measured_at: r.measured_at instanceof Date ? r.measured_at : new Date(r.measured_at),
    })),
  }
}

// ─── Latest value per signal for a package ───────────────────────────────────

export async function getLatestSignals(
  db: AnyDb,
  packageId: string
): Promise<Map<string, number>> {
  const result = await db.execute(sql`
    SELECT DISTINCT ON (signal_name) signal_name, value
    FROM signals
    WHERE package_id = ${packageId}::uuid
    ORDER BY signal_name, measured_at DESC
  `)

  const rows = toRows<{ signal_name: string; value: number }>(result)
  const map = new Map<string, number>()
  for (const r of rows) {
    map.set(r.signal_name, Number(r.value))
  }
  return map
}

// ─── Batch signal history ─────────────────────────────────────────────────────

export async function getSignalHistoryBatch(
  db: AnyDb,
  packageIds: string[],
  signalName: string,
  limitDays = 90
): Promise<Map<string, SignalSeries>> {
  if (packageIds.length === 0) return new Map()

  const cutoff = new Date(Date.now() - limitDays * 86400000)
  const idsStr = packageIds.map((id) => `'${id}'`).join(',')

  const result = await db.execute(sql.raw(`
    SELECT package_id::text, value, measured_at
    FROM signals
    WHERE package_id = ANY(ARRAY[${idsStr}]::uuid[])
      AND signal_name = '${signalName}'
      AND measured_at >= '${cutoff.toISOString()}'
    ORDER BY package_id, measured_at ASC
  `))

  const rows = toRows<{ package_id: string; value: number; measured_at: Date }>(result)

  const seriesMap = new Map<string, SignalSeries>()
  for (const r of rows) {
    const id = r.package_id
    if (!seriesMap.has(id)) {
      seriesMap.set(id, { packageId: id, signalName, points: [] })
    }
    seriesMap.get(id)!.points.push({
      value: Number(r.value),
      measured_at: r.measured_at instanceof Date ? r.measured_at : new Date(r.measured_at),
    })
  }
  return seriesMap
}
