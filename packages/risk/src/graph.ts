import { consumerEdges } from '@depgraph/db'
import { eq, sql } from 'drizzle-orm'
import { desc } from 'drizzle-orm'

export async function fetchGraphRiskInputs(
  packageId: string,
  db: any
): Promise<{
  dependentCount: number
  transitiveDepth: number
}> {
  const [{ count: dependentCountRaw }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(consumerEdges)
    .where(eq(consumerEdges.package_id, packageId))

  const dependentCount = dependentCountRaw ?? 0

  const depthRows = await db
    .select({ depth: consumerEdges.depth })
    .from(consumerEdges)
    .where(eq(consumerEdges.package_id, packageId))
    .orderBy(desc(consumerEdges.depth))
    .limit(1)

  const transitiveDepth = depthRows.length > 0 ? (depthRows[0].depth ?? 0) : 0

  return { dependentCount, transitiveDepth }
}
