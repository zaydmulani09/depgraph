import { policyViolations } from '@depgraph/db'
import { eq, isNull, and } from 'drizzle-orm'
import type { PolicyViolationResult } from './types'

export async function writePolicyViolations(
  db: any,
  violations: PolicyViolationResult[],
  snapshotId: string | null
): Promise<number> {
  if (violations.length === 0) return 0

  let written = 0

  await db.transaction(async (tx: any) => {
    for (const v of violations) {
      await tx
        .insert(policyViolations)
        .values({
          rule_id: v.ruleId,
          package_id: v.packageId,
          snapshot_id: snapshotId,
          action: v.action,
          remediation: v.remediation,
          resolved_at: null,
        })
        .onConflictDoNothing()

      written++
    }
  })

  return written
}

export async function resolveViolations(db: any, packageId: string): Promise<number> {
  const result = await db
    .update(policyViolations)
    .set({ resolved_at: new Date() })
    .where(and(eq(policyViolations.package_id, packageId), isNull(policyViolations.resolved_at)))
    .returning({ id: policyViolations.id })

  return (result as any[]).length
}
