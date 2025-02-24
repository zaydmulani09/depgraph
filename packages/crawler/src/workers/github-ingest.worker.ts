import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import { eq, and, sql } from 'drizzle-orm'
import type { db as DbType } from '@depgraph/db'
import {
  packages,
  repositories,
  packageRepositories,
  maintainers,
  signals,
} from '@depgraph/db'
import type { RateLimiter } from '../lib/rate-limiter'
import { GitHubClient, GitHubApiError } from '../integrations/github/client'
import { parseGitHubRepoUrl } from '../integrations/github/repo-parser'
import { computeGitHubSignals } from '../integrations/github/signals'
import { IdentityLinker } from '../integrations/github/identity-linker'
import { runAnalysisQueue } from '../queue'

const PREFIX = '[github-ingest]'

interface GitHubIngestDeps {
  redis: Redis
  github: GitHubClient
  db: typeof DbType
  limiter: RateLimiter
}

export function createGitHubIngestWorker(deps: GitHubIngestDeps): Worker {
  const { redis, github, db } = deps
  const identityLinker = new IdentityLinker({ github, db })

  return new Worker(
    'github-ingest',
    async (job) => {
      const { packageName, repositoryUrl } = job.data as {
        packageName: string
        repositoryUrl: string
      }

      console.log(`${PREFIX} Processing ${packageName} → ${repositoryUrl}`)

      // 1. Parse URL
      const parsed = parseGitHubRepoUrl(repositoryUrl)
      if (!parsed) {
        console.log(`${PREFIX} Skipping ${packageName}: unparseable URL "${repositoryUrl}"`)
        return { skipped: true, reason: 'unparseable_url' }
      }
      const { owner, repo } = parsed

      // 2. Fetch repo metadata
      let repoData
      try {
        repoData = await github.getRepo(owner, repo)
      } catch (err) {
        if (err instanceof GitHubApiError && err.status === 404) {
          console.log(`${PREFIX} Skipping ${packageName}: repo not found (${owner}/${repo})`)
          return { skipped: true, reason: 'repo_not_found' }
        }
        throw err
      }

      // 3. Fetch supplementary data in parallel
      const [commitsResult, contributorsResult, issuesResult, prsResult] =
        await Promise.allSettled([
          github.getCommitActivity(owner, repo),
          github.getContributors(owner, repo),
          github.getIssues(owner, repo, 'closed', 30),
          github.getPullRequests(owner, repo, 'closed', 30),
        ])

      if (commitsResult.status === 'rejected')
        console.warn(`${PREFIX} commit activity failed: ${commitsResult.reason}`)
      if (contributorsResult.status === 'rejected')
        console.warn(`${PREFIX} contributors failed: ${contributorsResult.reason}`)
      if (issuesResult.status === 'rejected')
        console.warn(`${PREFIX} issues failed: ${issuesResult.reason}`)
      if (prsResult.status === 'rejected')
        console.warn(`${PREFIX} PRs failed: ${prsResult.reason}`)

      const weeklyCommits = commitsResult.status === 'fulfilled' ? commitsResult.value : []
      const contributors = contributorsResult.status === 'fulfilled' ? contributorsResult.value : []
      const recentIssues = issuesResult.status === 'fulfilled' ? issuesResult.value : []
      const recentPRs = prsResult.status === 'fulfilled' ? prsResult.value : []

      // 4. Compute signals
      const computedSignals = computeGitHubSignals({
        weeklyCommits,
        contributors,
        recentIssues,
        recentPRs,
        repo: repoData,
      })

      let signalsWritten = 0
      let maintainersLinked = 0

      // 5. All DB writes in transaction
      await db.transaction(async (tx) => {
        // Upsert repository
        const [repoRow] = await tx
          .insert(repositories)
          .values({
            owner,
            repo,
            default_branch: repoData.default_branch,
            stars: repoData.stargazers_count,
            forks: repoData.forks_count,
            open_issues: repoData.open_issues_count,
            is_archived: repoData.archived,
            last_commit_at: repoData.pushed_at ? new Date(repoData.pushed_at) : null,
          })
          .onConflictDoUpdate({
            target: [repositories.owner, repositories.repo],
            set: {
              default_branch: sql`excluded.default_branch`,
              stars: sql`excluded.stars`,
              forks: sql`excluded.forks`,
              open_issues: sql`excluded.open_issues`,
              is_archived: sql`excluded.is_archived`,
              last_commit_at: sql`excluded.last_commit_at`,
              updated_at: sql`now()`,
            },
          })
          .returning({ id: repositories.id })

        const repositoryId = repoRow.id

        // Link repo to package
        const [pkg] = await tx
          .select({ id: packages.id })
          .from(packages)
          .where(and(eq(packages.ecosystem, 'npm'), eq(packages.name, packageName)))
          .limit(1)

        if (pkg) {
          await tx
            .insert(packageRepositories)
            .values({ package_id: pkg.id, repository_id: repositoryId })
            .onConflictDoNothing()
        }

        // Insert signals (time-series — no upsert, only if package exists)
        if (pkg) {
          for (const sig of computedSignals) {
            await tx.insert(signals).values({
              package_id: pkg.id,
              signal_name: sig.signal_name,
              value: sig.value,
              measured_at: sig.measured_at,
            })
            signalsWritten++
          }
        } else {
          console.warn(`${PREFIX} Package "${packageName}" not found in DB — skipping signals`)
        }
      })

      // 6. Link maintainers (outside transaction — best effort, calls GitHub API)
      const pkgMaintainers = await db
        .select({
          id: maintainers.id,
          registry_username: maintainers.registry_username,
          email: maintainers.email,
        })
        .from(maintainers)
        .where(eq(maintainers.ecosystem, 'npm'))

      for (const m of pkgMaintainers) {
        const linked = await identityLinker.linkNpmMaintainer(m.registry_username, m.email)
        if (linked.githubLogin) {
          await db
            .update(maintainers)
            .set({ github_login: linked.githubLogin, github_id: linked.githubId })
            .where(eq(maintainers.id, m.id))
          maintainersLinked++
        }
      }

      console.log(
        `${PREFIX} ${packageName}: ${signalsWritten} signals, ${maintainersLinked} maintainers linked`
      )

      // Enqueue analysis job after signals are written
      const [pkgRow] = await db
        .select({ id: packages.id })
        .from(packages)
        .where(and(eq(packages.ecosystem, 'npm'), eq(packages.name, packageName)))
        .limit(1)

      if (pkgRow) {
        await runAnalysisQueue.add('analyze', {
          mode: 'package',
          packageId: pkgRow.id,
          packageName,
        })
      }

      return { owner, repo, signalsWritten, maintainersLinked }
    },
    { connection: redis }
  )
}

