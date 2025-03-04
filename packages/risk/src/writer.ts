import { riskScores, riskExplanations } from '@depgraph/db'
import type { RiskScoreResult } from './types'

type Db = Parameters<typeof riskScores.$inferInsert extends never ? never : any>[0] extends never
  ? any
  : any

// Use a loose db type — the engine passes the Drizzle db instance
export async function writeRiskScore(result: RiskScoreResult, db: any): Promise<string> {
  let riskScoreId: string | null = null

  await db.transaction(async (tx: any) => {
    const [inserted] = await tx
      .insert(riskScores)
      .values({
        package_id: result.packageId,
        security_score: result.security.score,
        maintenance_score: result.maintenance.score,
        compatibility_score: result.compatibility.score,
        concentration_score: result.concentration.score,
        blast_radius_score: result.blast_radius.score,
        operational_score: result.operational.score,
        composite_score: result.composite,
      })
      .returning({ id: riskScores.id })

    riskScoreId = inserted.id

    if (result.explanations.length > 0) {
      await tx.insert(riskExplanations).values(
        result.explanations.map((exp) => ({
          risk_score_id: riskScoreId as string,
          factor_name: exp.factor_name,
          dimension: exp.dimension,
          contribution_pct: exp.contribution_pct,
          raw_value: exp.raw_value ?? null,
          description: exp.description,
        }))
      )
    }
  })

  if (!riskScoreId) throw new Error('writeRiskScore: failed to obtain inserted id')
  return riskScoreId
}
