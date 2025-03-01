import { request } from 'undici'
import type { RateLimiter } from '../../lib/rate-limiter'
import { withRetry } from '../../lib/retry'

export type OsvEcosystem = 'npm' | 'PyPI' | 'crates.io'

export interface OsvVulnerability {
  id: string
  aliases?: string[]
  summary?: string
  details?: string
  severity?: Array<{ type: string; score: string }>
  published: string
  modified: string
  withdrawn?: string
  affected: Array<{
    package: {
      ecosystem: string
      name: string
    }
    ranges?: Array<{
      type: string
      events: Array<{ introduced?: string; fixed?: string; last_affected?: string }>
    }>
    versions?: string[]
  }>
}

export interface OsvQueryResponse {
  vulns?: OsvVulnerability[]
}

export interface OsvBatchResponse {
  results: OsvQueryResponse[]
}

const BASE_URL = 'https://api.osv.dev/v1'
const BATCH_LIMIT = 1000

export class OsvClient {
  constructor(private readonly limiter: RateLimiter) {}

  private async post<T>(endpoint: string, body: unknown): Promise<T> {
    return withRetry(async () => {
      await this.limiter.throttle()
      const { statusCode, body: resBody } = await request(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      })
      const text = await resBody.text()
      if (statusCode < 200 || statusCode >= 300) {
        const err = Object.assign(new Error(`OSV API ${statusCode} at ${endpoint}`), {
          statusCode,
        })
        throw err
      }
      return JSON.parse(text) as T
    })
  }

  private async get<T>(endpoint: string): Promise<T> {
    return withRetry(async () => {
      await this.limiter.throttle()
      const { statusCode, body: resBody } = await request(`${BASE_URL}${endpoint}`, {
        headers: { Accept: 'application/json' },
      })
      const text = await resBody.text()
      if (statusCode < 200 || statusCode >= 300) {
        const err = Object.assign(new Error(`OSV API ${statusCode} at ${endpoint}`), {
          statusCode,
        })
        throw err
      }
      return JSON.parse(text) as T
    })
  }

  async queryPackage(ecosystem: OsvEcosystem, name: string): Promise<OsvVulnerability[]> {
    const res = await this.post<OsvQueryResponse>('/query', {
      package: { ecosystem, name },
    })
    return res.vulns ?? []
  }

  async queryBatch(
    packages: Array<{ ecosystem: OsvEcosystem; name: string }>
  ): Promise<OsvVulnerability[][]> {
    if (packages.length === 0) return []

    const results: OsvVulnerability[][] = []

    // Chunk into batches of BATCH_LIMIT
    for (let i = 0; i < packages.length; i += BATCH_LIMIT) {
      const chunk = packages.slice(i, i + BATCH_LIMIT)
      const res = await this.post<OsvBatchResponse>('/querybatch', {
        queries: chunk.map((p) => ({ package: p })),
      })
      for (const r of res.results) {
        results.push(r.vulns ?? [])
      }
    }

    return results
  }

  async getVulnerability(osvId: string): Promise<OsvVulnerability> {
    return this.get<OsvVulnerability>(`/vulns/${osvId}`)
  }

  async queryModifiedSince(
    ecosystem: OsvEcosystem,
    sinceTimestamp: string
  ): Promise<OsvVulnerability[]> {
    const res = await this.post<OsvQueryResponse>('/query', {
      package: { ecosystem },
      modified_since: sinceTimestamp,
    })
    return res.vulns ?? []
  }
}
