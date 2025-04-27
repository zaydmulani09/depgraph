// Usage: tsx src/benchmarks/runner.ts [--fixtures] [--ecosystem npm|pypi|cargo] [--scoring] [--help]
import { db } from '@depgraph/db'
import { isSqliteMode, createSqliteDb } from './sqlite-mode'
import { seedFromFixtures } from './offline-seed'
import { listFixtures } from '../fixtures/loader'
import type { FixtureEcosystem } from '../fixtures/loader'
import { runCrawlerBenchmark } from './crawler-benchmark'
import type { CrawlerBenchmarkResult } from './crawler-benchmark'
import { runScoringBenchmark } from './scoring-benchmark'
import type { RawStorage } from '../lib/storage'
import type { CrawlDedup } from '../lib/dedup'

// In-memory dedup for fixture-only benchmarks (no Redis required)
function createMemoryDedup(): CrawlDedup {
  const seen = new Set<string>()
  return {
    isSeen: async (key: string) => seen.has(key),
    markSeen: async (key: string) => { seen.add(key) },
    clear: async () => { seen.clear() },
  } as unknown as CrawlDedup
}

function printHelp(): void {
  console.log(`
depgraph benchmark suite v0.1.0

Usage: tsx src/benchmarks/runner.ts [options]

Options:
  --fixtures          Use fixture data instead of network (default: true)
  --no-fixtures       Use real network (requires live registry access)
  --ecosystem <eco>   Filter to one ecosystem: npm | pypi | cargo
  --scoring           Also run scoring benchmark after seeding
  --help              Print this help message
`)
}

function formatTable(results: CrawlerBenchmarkResult[]): string {
  const lines: string[] = []
  lines.push('┌─────────────────────────────────────────────────┐')
  lines.push('│ depgraph Benchmark Results                      │')
  lines.push('├───────────┬──────┬─────────┬──────┬────────────┤')
  lines.push('│ Ecosystem │ Pkgs │  Speed  │Cache │ Error rate │')
  lines.push('├───────────┼──────┼─────────┼──────┼────────────┤')

  for (const r of results) {
    const eco = r.ecosystem.padEnd(9)
    const pkgs = String(r.packagesAttempted).padStart(4)
    const speed = `${r.packagesPerSecond.toFixed(0)}/s`.padStart(7)
    const cache = `${(r.cacheHitRate * 100).toFixed(0)}%`.padStart(4)
    const errRate = `${(r.apiErrorRate * 100).toFixed(0)}%`.padStart(8)
    lines.push(`│ ${eco} │${pkgs} │${speed}  │${cache}  │${errRate}   │`)
  }

  lines.push('└───────────┴──────┴─────────┴──────┴────────────┘')
  return lines.join('\n')
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.includes('--help')) {
    printHelp()
    process.exit(0)
  }

  const noFixturesFlag = args.includes('--no-fixtures')
  const useFixtures = !noFixturesFlag
  const ecosystemArg = (() => {
    const idx = args.indexOf('--ecosystem')
    if (idx !== -1 && args[idx + 1]) return args[idx + 1] as FixtureEcosystem
    return null
  })()
  const runScoring = args.includes('--scoring')

  console.log('depgraph benchmark suite v0.1.0')
  console.log('================================')

  // Resolve DB
  let activeDb: typeof db
  if (isSqliteMode()) {
    console.log('[bench] SQLite mode detected — using SQLite DB')
    console.log('[bench] Note: run db:migrate first to create schema in your SQLite file')
    activeDb = await createSqliteDb()
  } else {
    activeDb = db
  }

  // Seed from fixtures
  if (useFixtures) {
    console.log('[bench] Seeding DB from fixtures...')
    try {
      const counts = await seedFromFixtures(activeDb, { verbose: false })
      console.log(`[bench] Seeded ${counts.packagesSeeded} packages, ${counts.versionsSeeded} versions, ${counts.depsSeeded} deps`)
    } catch (err) {
      console.error('[bench] Seed failed (DB may not be available):', err instanceof Error ? err.message : String(err))
    }
  }

  const ecosystems: FixtureEcosystem[] = ecosystemArg
    ? [ecosystemArg]
    : (['npm', 'pypi', 'cargo'] as FixtureEcosystem[])

  const dedup = createMemoryDedup()
  const results: CrawlerBenchmarkResult[] = []
  let anyFailure = false

  console.log('[bench] Running crawler benchmarks...')

  for (const ecosystem of ecosystems) {
    const allNames = await listFixtures(ecosystem)
    const packageNames =
      ecosystem === 'cargo' ? allNames.filter((n) => !n.endsWith('-deps')) : allNames

    const result = await runCrawlerBenchmark({
      ecosystem,
      packages: packageNames,
      useFixtures,
      storage: null as unknown as RawStorage,
      dedup,
    })

    results.push(result)

    if (result.packagesFailed > 0) {
      anyFailure = true
      for (const e of result.errors) {
        console.error(`[bench] Error — ${ecosystem}/${e.packageName}: ${e.error}`)
      }
    }
  }

  console.log('')
  console.log(formatTable(results))
  console.log('')

  if (runScoring) {
    console.log('[bench] Running scoring benchmark...')
    try {
      const scoringResult = await runScoringBenchmark({
        db: activeDb,
        packageIds: [],
        runs: 2,
        concurrency: 3,
      })
      console.log('[bench] Scoring results:')
      console.log(`  Packages scored: ${scoringResult.packagesScored}`)
      console.log(`  Speed: ${scoringResult.packagesPerSecond.toFixed(1)}/s`)
      console.log(`  Max variance: ${scoringResult.scoreConsistency.maxVariance.toFixed(4)}`)
      console.log(`  Explanation coverage: ${(scoringResult.explanationCoverage * 100).toFixed(0)}%`)
      if (scoringResult.scoreConsistency.inconsistentPackages.length > 0) {
        console.warn('[bench] Inconsistent packages:', scoringResult.scoreConsistency.inconsistentPackages)
        anyFailure = true
      }
    } catch (err) {
      console.error('[bench] Scoring benchmark failed:', err instanceof Error ? err.message : String(err))
    }
  }

  process.exit(anyFailure ? 1 : 0)
}

main().catch((err) => {
  console.error('[bench] Fatal error:', err)
  process.exit(1)
})
