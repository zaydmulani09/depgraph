import { sql } from 'drizzle-orm'
import { getSignalHistory, getLatestSignals } from './timeseries'
import { computeTrend, TrendResult } from './trend-detector'

export interface BusFactorAlert {
  packageId: string
  packageName: string
  currentBusFactor: number
  previousBusFactor: number | null
  trend: TrendResult
  alertLevel: 'new_single_maintainer' | 'declining_to_one' | 'consistently_one'
}

type AnyDb = { execute: (q: unknown) => Promise<unknown> }

function toRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  const r = result as { rows?: T[] }
  return r.rows ?? []
}

export async function detectBusFactorAlerts(
  db: AnyDb,
  packageIds?: string[]
): Promise<BusFactorAlert[]> {
  // Get packages to check
  let pkgRows: Array<{ id: string; name: string }>

  if (packageIds && packageIds.length > 0) {
    const idsStr = packageIds.map((id) => `'${id}'`).join(',')
    const result = await db.execute(sql.raw(`
      SELECT id::text, name FROM packages
      WHERE id = ANY(ARRAY[${idsStr}]::uuid[])
    `))
    pkgRows = toRows<{ id: string; name: string }>(result)
  } else {
    // Only scan packages that have at least one bus_factor signal
    const result = await db.execute(sql.raw(`
      SELECT DISTINCT p.id::text, p.name
      FROM packages p
      JOIN signals s ON s.package_id = p.id AND s.signal_name = 'bus_factor'
    `))
    pkgRows = toRows<{ id: string; name: string }>(result)
  }

  const alerts: BusFactorAlert[] = []

  for (const pkg of pkgRows) {
    const latestSignals = await getLatestSignals(db, pkg.id)
    const currentBusFactor = latestSignals.get('bus_factor')

    // Skip if no bus_factor signal at all
    if (currentBusFactor === undefined) continue
    // Only alert when current bus factor is 1
    if (Math.round(currentBusFactor) !== 1) continue

    const series = await getSignalHistory(db, pkg.id, 'bus_factor', 60)
    const trend = computeTrend(series)

    let alertLevel: BusFactorAlert['alertLevel']
    let previousBusFactor: number | null = null

    if (series.points.length <= 1) {
      // New package or only one data point
      alertLevel = 'new_single_maintainer'
    } else {
      // Look at history to determine if it was ever > 1
      const prevPoints = series.points.slice(0, -1)
      const prevMax = Math.max(...prevPoints.map((p) => p.value))
      previousBusFactor = prevMax

      if (prevMax > 1) {
        alertLevel = 'declining_to_one'
      } else {
        // Check if consistently 1 for 30+ days
        const thirtyDaysAgo = Date.now() - 30 * 86400000
        const recentPoints = series.points.filter(
          (p) => p.measured_at.getTime() >= thirtyDaysAgo
        )
        if (recentPoints.length >= 2 && recentPoints.every((p) => Math.round(p.value) === 1)) {
          alertLevel = 'consistently_one'
        } else {
          alertLevel = 'consistently_one'
        }
      }
    }

    alerts.push({
      packageId: pkg.id,
      packageName: pkg.name,
      currentBusFactor: Math.round(currentBusFactor),
      previousBusFactor,
      trend,
      alertLevel,
    })
  }

  return alerts
}
