import { request } from 'undici'
import type { RateLimiter } from '../../lib/rate-limiter'
import { withRetry } from '../../lib/retry'

const BASE = 'https://crates.io/api/v1'
const UA = 'depgraph-crawler/0.1.0 (contact: zaydmulani@gmail.com)'

export interface CrateVersion {
  id: number
  crate: string
  num: string
  dl_path: string
  readme_path: string | null
  created_at: string
  updated_at: string
  downloads: number
  features: Record<string, string[]>
  yanked: boolean
  license: string | null
  crate_size: number | null
  published_by: { login: string; name: string | null; email: string | null } | null
  audit_actions: Array<{ action: string; user: { login: string } }>
}

export interface CrateMetadata {
  crate: {
    id: string
    name: string
    description: string | null
    homepage: string | null
    repository: string | null
    documentation: string | null
    downloads: number
    recent_downloads: number
    max_version: string
    newest_version: string
    created_at: string
    updated_at: string
    keywords: string[]
    categories: string[]
  }
  versions: CrateVersion[]
  keywords: Array<{ keyword: string }>
  categories: Array<{ category: string }>
}

export interface CrateDependency {
  id: number
  version_id: number
  crate_id: string
  req: string
  optional: boolean
  default_features: boolean
  features: string[]
  kind: 'normal' | 'dev' | 'build'
  target: string | null
}

export function normalizeCrateName(name: string): string {
  return name.trim()
}

export class CratesIoClient {
  constructor(private readonly limiter: RateLimiter) {}

  async getCrate(name: string): Promise<CrateMetadata> {
    return withRetry(async () => {
      await this.limiter.throttle()
      const url = `${BASE}/crates/${encodeURIComponent(name)}`
      const { statusCode, body } = await request(url, {
        headers: { Accept: 'application/json', 'User-Agent': UA },
      })
      if (statusCode !== 200) {
        throw Object.assign(new Error(`crates.io returned ${statusCode} for ${name}`), { statusCode })
      }
      const text = await body.text()
      return JSON.parse(text) as CrateMetadata
    })
  }

  async getCrateDependencies(name: string, version: string): Promise<CrateDependency[]> {
    return withRetry(async () => {
      await this.limiter.throttle()
      const url = `${BASE}/crates/${encodeURIComponent(name)}/${encodeURIComponent(version)}/dependencies`
      const { statusCode, body } = await request(url, {
        headers: { Accept: 'application/json', 'User-Agent': UA },
      })
      if (statusCode !== 200) {
        throw Object.assign(new Error(`crates.io returned ${statusCode} for ${name}@${version} deps`), { statusCode })
      }
      const text = await body.text()
      const data = JSON.parse(text) as { dependencies: CrateDependency[] }
      return data.dependencies ?? []
    })
  }

  async searchCrates(query: string, perPage = 20): Promise<string[]> {
    try {
      await this.limiter.throttle()
      const url = `${BASE}/crates?q=${encodeURIComponent(query)}&per_page=${perPage}`
      const { statusCode, body } = await request(url, {
        headers: { Accept: 'application/json', 'User-Agent': UA },
      })
      if (statusCode !== 200) return []
      const text = await body.text()
      const data = JSON.parse(text) as { crates: Array<{ name: string }> }
      return (data.crates ?? []).map((c) => c.name)
    } catch {
      return []
    }
  }

  getCrateDownloads(metadata: CrateMetadata): number {
    return metadata.crate.recent_downloads
  }
}
