import { request } from 'undici'
import type { RateLimiter } from '../../lib/rate-limiter'
import { withRetry } from '../../lib/retry'

export interface PypiReleaseFile {
  filename: string
  url: string
  size: number
  upload_time: string
  requires_python: string | null
  packagetype: 'sdist' | 'bdist_wheel' | string
  python_version: string
  digests: { sha256: string; md5: string }
}

export interface PypiPackageMetadata {
  info: {
    name: string
    version: string
    summary: string | null
    home_page: string | null
    project_url: string | null
    project_urls: Record<string, string> | null
    license: string | null
    author: string | null
    author_email: string | null
    maintainer: string | null
    maintainer_email: string | null
    requires_python: string | null
    requires_dist: string[] | null
    classifiers: string[]
    keywords: string | null
  }
  releases: Record<string, PypiReleaseFile[]>
  urls: PypiReleaseFile[]
  last_serial: number
}

export interface PypiVersionMetadata {
  info: PypiPackageMetadata['info']
  urls: PypiReleaseFile[]
}

export function normalizePypiName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, '-')
}

const BASE = 'https://pypi.org/pypi'

export class PypiRegistryClient {
  constructor(private readonly limiter: RateLimiter) {}

  async getPackageMetadata(name: string): Promise<PypiPackageMetadata> {
    const normalized = normalizePypiName(name)
    return withRetry(async () => {
      await this.limiter.throttle()
      const url = `${BASE}/${encodeURIComponent(normalized)}/json`
      const { statusCode, body } = await request(url, {
        headers: { Accept: 'application/json' },
      })
      if (statusCode !== 200) {
        throw Object.assign(new Error(`PyPI returned ${statusCode} for ${normalized}`), { statusCode })
      }
      const text = await body.text()
      return JSON.parse(text) as PypiPackageMetadata
    })
  }

  async getVersionMetadata(name: string, version: string): Promise<PypiVersionMetadata> {
    const normalized = normalizePypiName(name)
    return withRetry(async () => {
      await this.limiter.throttle()
      const url = `${BASE}/${encodeURIComponent(normalized)}/${encodeURIComponent(version)}/json`
      const { statusCode, body } = await request(url, {
        headers: { Accept: 'application/json' },
      })
      if (statusCode !== 200) {
        throw Object.assign(new Error(`PyPI returned ${statusCode} for ${normalized}@${version}`), { statusCode })
      }
      const text = await body.text()
      return JSON.parse(text) as PypiVersionMetadata
    })
  }

  // PyPI downloads require pypistats.org API — not yet implemented
  async getPackageDownloads(_name: string): Promise<number> {
    return 0
  }
}
