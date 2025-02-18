import { request } from 'undici'
import type { RateLimiter } from '../../lib/rate-limiter'
import { withRetry } from '../../lib/retry'

export interface NpmPackageMetadata {
  name: string
  description?: string
  homepage?: string
  repository?: { url?: string } | string
  'dist-tags': Record<string, string>
  versions: Record<string, NpmVersionMetadata>
  time: Record<string, string>
  maintainers?: Array<{ name: string; email?: string }>
}

export interface NpmVersionMetadata {
  version: string
  description?: string
  license?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  types?: string
  typings?: string
  dist?: { tarball?: string }
  maintainers?: Array<{ name: string; email?: string }>
  deprecated?: string
}

export class NpmRegistryClient {
  constructor(private readonly limiter: RateLimiter) {}

  async getPackageMetadata(name: string): Promise<NpmPackageMetadata> {
    return withRetry(async () => {
      await this.limiter.throttle()
      const encodedName = name.startsWith('@')
        ? `@${encodeURIComponent(name.slice(1))}`
        : encodeURIComponent(name)
      const url = `https://registry.npmjs.org/${encodedName}`
      const { statusCode, body } = await request(url, {
        headers: { Accept: 'application/json' },
      })
      if (statusCode !== 200) {
        const err = Object.assign(new Error(`npm registry returned ${statusCode} for ${name}`), {
          statusCode,
        })
        throw err
      }
      const text = await body.text()
      return JSON.parse(text) as NpmPackageMetadata
    })
  }

  async getPackageDownloads(name: string): Promise<number> {
    try {
      await this.limiter.throttle()
      const encodedName = encodeURIComponent(name)
      const url = `https://api.npmjs.org/downloads/point/last-week/${encodedName}`
      const { statusCode, body } = await request(url, {
        headers: { Accept: 'application/json' },
      })
      if (statusCode !== 200) return 0
      const text = await body.text()
      const data = JSON.parse(text) as { downloads?: number }
      return data.downloads ?? 0
    } catch {
      return 0
    }
  }

  async searchPackages(query: string, size = 20): Promise<string[]> {
    try {
      await this.limiter.throttle()
      const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${size}`
      const { statusCode, body } = await request(url, {
        headers: { Accept: 'application/json' },
      })
      if (statusCode !== 200) return []
      const text = await body.text()
      const data = JSON.parse(text) as {
        objects: Array<{ package: { name: string } }>
      }
      return data.objects.map((o) => o.package.name)
    } catch {
      return []
    }
  }
}
