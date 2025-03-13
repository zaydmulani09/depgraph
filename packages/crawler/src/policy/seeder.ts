import { sql } from 'drizzle-orm'
import { policyRules } from '@depgraph/db'
import { BUILTIN_RULES } from './builtin-rules'
import type { PolicyRule, PolicyCondition } from './types'

export async function seedBuiltinRules(
  db: any
): Promise<{ seeded: number; skipped: number }> {
  let seeded = 0
  let skipped = 0

  for (const rule of BUILTIN_RULES) {
    const existing = await db
      .select({ id: policyRules.id })
      .from(policyRules)
      .where(sql`${policyRules.name} = ${rule.name}`)
      .limit(1)

    if (existing.length > 0) {
      skipped++
      continue
    }

    await db.insert(policyRules).values({
      name: rule.name,
      description: rule.description,
      action: rule.action,
      condition_json: rule.condition,
      is_enabled: rule.is_enabled,
    })

    seeded++
  }

  return { seeded, skipped }
}

export async function loadEnabledRules(db: any): Promise<PolicyRule[]> {
  const rows = await db
    .select({
      id: policyRules.id,
      name: policyRules.name,
      description: policyRules.description,
      action: policyRules.action,
      condition_json: policyRules.condition_json,
      is_enabled: policyRules.is_enabled,
    })
    .from(policyRules)
    .where(sql`${policyRules.is_enabled} = true`)

  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    action: row.action as PolicyRule['action'],
    condition: row.condition_json as PolicyCondition,
    is_enabled: row.is_enabled,
  }))
}
