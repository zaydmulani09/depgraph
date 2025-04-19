import { request } from 'undici'

export interface ViolationResult {
  packageName: string
  action: 'block' | 'warn' | 'require_approval'
  ruleName: string
  remediation: string
  compositeScore: number
}

export interface PackageRiskResult {
  name: string
  ecosystem: string
  compositeScore: number
  securityScore: number
  maintenanceScore: number
  advisoryCount: number
}

export interface ActionApiClient {
  evaluatePackages(
    packages: Array<{ name: string; ecosystem: string; version: string }>
  ): Promise<ViolationResult[]>

  getPackageRisk(ecosystem: string, name: string): Promise<PackageRiskResult | null>
}

interface RawPkgDetail {
  id: string
  name: string
  ecosystem: string
  composite_score: number | null
  security_score: number | null
  maintenance_score: number | null
  advisoryCount: number | null
}

interface RawViolationRow {
  id: string
  action: string
  remediation: string | null
  package_name: string | null
  rule_name: string | null
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return
  let idx = 0

  async function worker(): Promise<void> {
    while (idx < items.length) {
      const i = idx++
      await fn(items[i]!)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
}

export function createApiClient(options: { apiUrl: string; apiKey: string }): ActionApiClient {
  const { apiUrl, apiKey } = options
  const headers = { 'x-api-key': apiKey, accept: 'application/json' }

  return {
    async evaluatePackages(packages) {
      const allViolations: ViolationResult[] = []

      await mapWithConcurrency(packages, 5, async (pkg) => {
        try {
          const pkgRes = await request(
            `${apiUrl}/packages/${encodeURIComponent(pkg.ecosystem)}/${encodeURIComponent(pkg.name)}`,
            { headers }
          )

          if (pkgRes.statusCode === 404) return
          if (pkgRes.statusCode !== 200) return

          const pkgBody = (await pkgRes.body.json()) as { data: RawPkgDetail }
          const { id, composite_score } = pkgBody.data

          const violRes = await request(
            `${apiUrl}/policy/violations?packageId=${encodeURIComponent(id)}&resolved=false`,
            { headers }
          )

          if (violRes.statusCode !== 200) return

          const violBody = (await violRes.body.json()) as { data: RawViolationRow[] }

          for (const v of violBody.data) {
            if (v.action === 'block' || v.action === 'warn' || v.action === 'require_approval') {
              allViolations.push({
                packageName: v.package_name ?? pkg.name,
                action: v.action,
                ruleName: v.rule_name ?? 'unknown',
                remediation: v.remediation ?? '',
                compositeScore: composite_score ?? 0,
              })
            }
          }
        } catch {
          // Skip packages that fail — degrade gracefully
        }
      })

      return allViolations
    },

    async getPackageRisk(ecosystem, name) {
      try {
        const res = await request(
          `${apiUrl}/packages/${encodeURIComponent(ecosystem)}/${encodeURIComponent(name)}`,
          { headers }
        )

        if (res.statusCode === 404) return null
        if (res.statusCode !== 200) return null

        const body = (await res.body.json()) as { data: RawPkgDetail }
        const d = body.data

        return {
          name: d.name,
          ecosystem: d.ecosystem,
          compositeScore: d.composite_score ?? 0,
          securityScore: d.security_score ?? 0,
          maintenanceScore: d.maintenance_score ?? 0,
          advisoryCount: d.advisoryCount ?? 0,
        }
      } catch {
        return null
      }
    },
  }
}
