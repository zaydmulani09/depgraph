import { eq, and } from 'drizzle-orm'
import type { db as DbType } from '@depgraph/db'
import { maintainers, ecosystemEnum } from '@depgraph/db'
import type { GitHubClient } from './client'

interface IdentityLinkerDeps {
  github: GitHubClient
  db: typeof DbType
}

interface LinkResult {
  githubLogin: string | null
  githubId: number | null
}

export class IdentityLinker {
  constructor(private readonly deps: IdentityLinkerDeps) {}

  async linkNpmMaintainer(
    registryUsername: string,
    emailHint: string | null
  ): Promise<LinkResult> {
    try {
      // Strategy 1: parse GitHub noreply email format {id}+{login}@users.noreply.github.com
      if (emailHint) {
        const noReplyMatch = emailHint.match(/^(\d+)\+([^@]+)@users\.noreply\.github\.com$/)
        if (noReplyMatch) {
          return {
            githubLogin: noReplyMatch[2],
            githubId: Number(noReplyMatch[1]),
          }
        }
      }

      // Strategy 2: check DB cache
      const [existing] = await this.deps.db
        .select({
          github_login: maintainers.github_login,
          github_id: maintainers.github_id,
        })
        .from(maintainers)
        .where(
          and(
            eq(maintainers.ecosystem, 'npm'),
            eq(maintainers.registry_username, registryUsername)
          )
        )
        .limit(1)

      if (existing?.github_login) {
        return {
          githubLogin: existing.github_login,
          githubId: existing.github_id,
        }
      }

      // Strategy 3: try GitHub API by registry username
      const user = await this.deps.github.getUserByLogin(registryUsername)
      if (user) {
        return { githubLogin: user.login, githubId: user.id }
      }

      // Strategy 4: could not link
      return { githubLogin: null, githubId: null }
    } catch {
      return { githubLogin: null, githubId: null }
    }
  }
}
