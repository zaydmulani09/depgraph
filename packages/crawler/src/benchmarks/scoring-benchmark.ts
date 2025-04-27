import type { db as DbType } from '@depgraph/db'
import { scorePackageBatch } from '@depgraph/risk'

export interface ScoringBenchmarkResult {
  packagesScored: number
  totalDurationMs: number
  avgDurationPerPackageMs: number
  packagesPerSecond: number
  scoreConsistency: {
    maxVariance: number
    avgVariance: number
    inconsistentPackages: string[]
  }
  explanationCoverage: number
}

export async function runScoringBenchmark(options: {
  db: typeof DbType
  packageIds: string[]
  runs?: number
  concurrency?: number
}): Promise<ScoringBenchmarkResult> {
  const { db, packageIds, runs = 2, concurrency = 3 } = options

  type RunResult = Array<{ packageId: string; result: { composite: number; explanations: Array<unknown> } | null }>
  const allRunResults: RunResult[] = []
  const runDurations: number[] = []

  for (let i = 0; i < runs; i++) {
    const start = Date.now()
    const results = await scorePackageBatch(packageIds, db, concurrency)
    runDurations.push(Date.now() - start)
    allRunResults.push(
      results.map((r) => ({
        packageId: r.packageId,
        result: r.result
          ? { composite: r.result.composite, explanations: r.result.explanations }
          : null,
      }))
    )
  }

  const totalDurationMs = runDurations.reduce((a, b) => a + b, 0)
  const packagesScored = packageIds.length
  const avgDurationPerPackageMs =
    packagesScored > 0 && runs > 0 ? (totalDurationMs / runs) / packagesScored : 0
  const packagesPerSecond =
    totalDurationMs > 0 ? (packagesScored * runs / totalDurationMs) * 1000 : packagesScored

  // Consistency check: compare composite scores across all runs
  const inconsistentPackages: string[] = []
  let maxVariance = 0
  let totalVariance = 0

  for (const packageId of packageIds) {
    const scores = allRunResults
      .map((run) => run.find((r) => r.packageId === packageId)?.result?.composite ?? null)
      .filter((s): s is number => s !== null)

    if (scores.length < 2) continue

    const minScore = Math.min(...scores)
    const maxScore = Math.max(...scores)
    const variance = maxScore - minScore

    if (variance > maxVariance) maxVariance = variance
    totalVariance += variance

    if (variance > 0.1) {
      inconsistentPackages.push(packageId)
    }
  }

  const avgVariance = packagesScored > 0 ? totalVariance / packagesScored : 0

  // Explanation coverage: % of packages with at least 1 explanation in the last run
  const lastRun = allRunResults[allRunResults.length - 1] ?? []
  const withExplanations = lastRun.filter(
    (r) => r.result && r.result.explanations.length > 0
  ).length
  const explanationCoverage = lastRun.length > 0 ? withExplanations / lastRun.length : 0

  return {
    packagesScored,
    totalDurationMs,
    avgDurationPerPackageMs,
    packagesPerSecond,
    scoreConsistency: {
      maxVariance,
      avgVariance,
      inconsistentPackages,
    },
    explanationCoverage,
  }
}
