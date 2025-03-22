import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'X-API-Key': (import.meta as Record<string, unknown> & { env: Record<string, string> }).env.VITE_API_KEY ?? 'dev-secret-key',
  },
  timeout: 15_000,
})

// ─── Response types ───────────────────────────────────────────────────────────

export interface MetaPage {
  total: number
  page: number
  limit: number
  pages: number
  timestamp: string
  status: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: MetaPage
}

export interface PackageSummary {
  id: string
  name: string
  ecosystem: string
  latest_version: string | null
  composite_score: number | null
  security_score: number | null
  maintenance_score: number | null
  last_published_at: string | null
  weekly_downloads: number | null
}

export interface RiskExplanation {
  factor_name: string
  dimension: string
  contribution_pct: number
  raw_value: number | null
  description: string
}

export interface Advisory {
  id: string
  osv_id: string
  title: string
  severity: string
  cvss_score: number | null
  published_at: string | null
  withdrawn_at: string | null
  affected_versions?: unknown[]
}

export interface BlastRadius {
  consumerCount: number
  minDepth: number | null
  maxDepth: number | null
}

export interface PackageDetail extends PackageSummary {
  description: string | null
  homepage: string | null
  repository_url: string | null
  first_published_at: string | null
  security_score: number | null
  maintenance_score: number | null
  compatibility_score: number | null
  concentration_score: number | null
  blast_radius_score: number | null
  operational_score: number | null
  scored_at: string | null
  explanations: RiskExplanation[]
  advisories: Advisory[]
  advisoryCount: number
  signals: Array<{ signal_name: string; value: number; measured_at: string }>
  blastRadius: BlastRadius
}

export interface RiskHistoryPoint {
  composite_score: number
  security_score: number
  maintenance_score: number
  compatibility_score: number
  concentration_score: number
  blast_radius_score: number
  operational_score: number
  scored_at: string
}

export interface SnapshotMeta {
  id: string
  label: string | null
  packageCount: number
  avgCompositeScore: number | null
  maxCompositeScore: number | null
  violationCount: number | null
  snapshottedAt: string
}

export interface SnapshotData {
  version: number
  generatedAt: string
  packages: unknown[]
  summary: {
    totalPackages: number
    avgCompositeScore: number
    maxCompositeScore: number
  }
}

export interface HealthResponse {
  status: string
  version: string
  timestamp: string
  services: {
    database: 'ok' | 'error'
    redis: 'ok' | 'error'
  }
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function fetchPackages(params?: {
  ecosystem?: string
  page?: number
  limit?: number
  sort?: string
}): Promise<PaginatedResponse<PackageSummary>> {
  const res = await apiClient.get<PaginatedResponse<PackageSummary>>('/packages', { params })
  return res.data
}

export async function fetchPackageDetail(
  ecosystem: string,
  name: string
): Promise<PackageDetail> {
  const res = await apiClient.get<{ data: PackageDetail }>(`/packages/${ecosystem}/${name}`)
  return res.data.data
}

export async function fetchPackageHistory(
  ecosystem: string,
  name: string,
  limit = 10
): Promise<RiskHistoryPoint[]> {
  const res = await apiClient.get<{ data: RiskHistoryPoint[] }>(
    `/packages/${ecosystem}/${name}/history`,
    { params: { limit } }
  )
  return res.data.data
}

export async function fetchPackageAdvisories(
  ecosystem: string,
  name: string
): Promise<Advisory[]> {
  const res = await apiClient.get<{ data: Advisory[] }>(
    `/packages/${ecosystem}/${name}/advisories`
  )
  return res.data.data
}

export async function fetchSnapshots(limit = 10): Promise<SnapshotMeta[]> {
  const res = await apiClient.get<{ data: SnapshotMeta[] }>('/snapshots', { params: { limit } })
  return res.data.data
}

export async function fetchSnapshot(id: string): Promise<SnapshotData> {
  const res = await apiClient.get<{ data: SnapshotData }>(`/snapshots/${id}`)
  return res.data.data
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await apiClient.get<HealthResponse>('/health')
  return res.data
}

// ─── Diff + policy types ─────────────────────────────────────────────────────

export interface SnapshotPackageEntry {
  packageId: string
  packageName: string
  ecosystem: string
  compositeScore: number
  securityScore: number
  maintenanceScore: number
  compatibilityScore: number
  concentrationScore: number
  blastRadiusScore: number
  operationalScore: number
  advisoryCount: number
  maintainerCount: number
  dependentCount: number
  topExplanations: Array<{
    factor_name: string
    dimension: string
    contribution_pct: number
    description: string
  }>
}

export interface SnapshotDiffEntry {
  packageId: string
  packageName: string
  previousScore: number
  currentScore: number
  delta: number
  changedDimensions: string[]
}

export interface VulnerabilityChain {
  packageId: string
  packageName: string
  advisoryId: string
  severity: string
  introducedAt: string
  affectedDownstreamCount: number
}

export interface SnapshotDiff {
  previousSnapshotId: string
  currentSnapshotId: string
  previousGeneratedAt: string
  currentGeneratedAt: string
  added: SnapshotPackageEntry[]
  removed: SnapshotPackageEntry[]
  improved: SnapshotDiffEntry[]
  degraded: SnapshotDiffEntry[]
  unchanged: string[]
  newVulnerabilityChains: VulnerabilityChain[]
}

export interface PolicyRule {
  id: string
  name: string
  description: string | null
  action: 'block' | 'warn' | 'require_approval'
  condition_json: unknown
  is_enabled: boolean
  created_at: string
}

export interface PolicyViolation {
  id: string
  rule_id?: string
  package_id?: string
  snapshot_id?: string | null
  action: 'block' | 'warn' | 'require_approval'
  remediation: string | null
  resolved_at: string | null
  created_at: string
  packageName?: string
  ruleName?: string
  ecosystem?: string
}

// ─── Diff + policy API functions ──────────────────────────────────────────────

export async function fetchSnapshotDiff(
  previousSnapshotId: string,
  currentSnapshotId: string
): Promise<SnapshotDiff> {
  const res = await apiClient.post<{ data: SnapshotDiff }>('/snapshots/diff', {
    previousSnapshotId,
    currentSnapshotId,
  })
  return res.data.data
}

export async function fetchPolicyRules(): Promise<PolicyRule[]> {
  const res = await apiClient.get<{ data: PolicyRule[] }>('/policy/rules')
  return res.data.data
}

export async function fetchPolicyViolations(params?: {
  packageId?: string
  action?: 'block' | 'warn' | 'require_approval'
  resolved?: boolean
  page?: number
  limit?: number
}): Promise<PaginatedResponse<PolicyViolation>> {
  type RawRow = {
    id: string
    action: string
    remediation: string | null
    resolved_at: string | null
    created_at: string
    package_name: string
    ecosystem: string
    rule_name: string
  }
  const res = await apiClient.get<PaginatedResponse<RawRow>>('/policy/violations', { params })
  return {
    ...res.data,
    data: res.data.data.map((row) => ({
      id: row.id,
      action: row.action as PolicyViolation['action'],
      remediation: row.remediation,
      resolved_at: row.resolved_at,
      created_at: row.created_at,
      packageName: row.package_name,
      ruleName: row.rule_name,
      ecosystem: row.ecosystem,
    })),
  }
}

export async function evaluatePolicyDryRun(snapshotId: string): Promise<PolicyViolation[]> {
  const res = await apiClient.post<{ data: PolicyViolation[] }>('/policy/evaluate', { snapshotId })
  return res.data.data
}

export async function resolveViolation(violationId: string): Promise<PolicyViolation> {
  const res = await apiClient.patch<{ data: PolicyViolation }>(
    `/policy/violations/${violationId}/resolve`
  )
  return res.data.data
}

// ─── Graph types ──────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string
  name: string
  ecosystem: string
  compositeScore?: number
}

export interface GraphEdge {
  fromId: string
  toId: string
  depth: number
}

export interface BlastRadiusResult {
  directConsumers: number
  transitiveConsumers: number
  maxDepth: number
  topConsumers: Array<{ packageId: string; packageName: string; depth: number }>
}

export interface ChokepointResult {
  packageId: string
  packageName: string
  ecosystem: string
  centralityScore: number
  compositeScore?: number
}

// ─── Graph API functions ──────────────────────────────────────────────────────

export async function fetchPackageSubgraph(
  packageId: string,
  depth?: number
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const res = await apiClient.get<{ data: { nodes: GraphNode[]; edges: GraphEdge[] } }>(
    `/graph/package/${packageId}/subgraph`,
    { params: depth !== undefined ? { depth } : undefined }
  )
  return res.data.data
}

export async function fetchBlastRadius(packageId: string): Promise<BlastRadiusResult> {
  const res = await apiClient.get<{ data: BlastRadiusResult }>(
    `/graph/package/${packageId}/blast-radius`
  )
  return res.data.data
}

// ─── Forecasting types ───────────────────────────────────────────────────────

export interface SignalSnapshot {
  packageId: string
  signals: Record<string, number>
}

export interface AbandonmentScoreResult {
  probability: number
  recommendation: 'monitor' | 'warn' | 'critical'
  confidence: 'high' | 'medium' | 'low'
  breakdown: Array<{
    name: string
    score: number
    weight: number
    description: string
  }>
}

// ─── Forecasting API functions ────────────────────────────────────────────────

export async function fetchPackageSignals(
  ecosystem: string,
  name: string
): Promise<SignalSnapshot> {
  const detail = await fetchPackageDetail(ecosystem, name)
  const signals: Record<string, number> = {}
  for (const s of detail.signals) {
    if (!(s.signal_name in signals)) signals[s.signal_name] = s.value
  }
  return { packageId: detail.id, signals }
}

export async function fetchAbandonmentScore(
  ecosystem: string,
  name: string
): Promise<AbandonmentScoreResult> {
  const detail = await fetchPackageDetail(ecosystem, name)
  const sigMap: Record<string, number> = {}
  for (const s of detail.signals) {
    if (!(s.signal_name in sigMap)) sigMap[s.signal_name] = s.value
  }

  const days = sigMap['days_since_last_commit']
  const maintainerCount = sigMap['active_maintainer_count']
  const busFactor = sigMap['bus_factor']

  // Score each signal 0–1 (higher = more abandoned)
  const daysScore = days != null ? Math.min(1, days / 365) : 0.5
  const trendScore = 0.5 // neutral — commit trend not available client-side
  const maintScore = maintainerCount != null ? Math.max(0, 1 - maintainerCount / 5) : 0.5
  const busScore = busFactor != null ? Math.max(0, 1 - busFactor / 3) : 0.5

  const probability = daysScore * 0.30 + trendScore * 0.25 + maintScore * 0.25 + busScore * 0.20

  const realSigs = [days, maintainerCount, busFactor].filter((v) => v != null).length
  const confidence: AbandonmentScoreResult['confidence'] =
    realSigs >= 3 ? 'high' : realSigs >= 2 ? 'medium' : 'low'

  const recommendation: AbandonmentScoreResult['recommendation'] =
    probability >= 0.7 ? 'critical' : probability >= 0.4 ? 'warn' : 'monitor'

  return {
    probability,
    recommendation,
    confidence,
    breakdown: [
      { name: 'days_since_last_commit', score: daysScore, weight: 0.30, description: 'Days since last commit' },
      { name: 'commit_freq_trend', score: trendScore, weight: 0.25, description: 'Commit frequency trend' },
      { name: 'active_maintainer_count', score: maintScore, weight: 0.25, description: 'Active maintainer count' },
      { name: 'bus_factor', score: busScore, weight: 0.20, description: 'Bus factor' },
    ],
  }
}

/** Alias for fetchPackageHistory — same data, forecasting-friendly name */
export async function fetchSignalHistory(
  ecosystem: string,
  name: string,
  limit?: number
): Promise<RiskHistoryPoint[]> {
  return fetchPackageHistory(ecosystem, name, limit)
}

// ─── Portfolio types ──────────────────────────────────────────────────────────

export interface PortfolioSummary {
  totalPackages: number
  totalVersions: number
  totalAdvisories: number
  avgCompositeScore: number
  maxCompositeScore: number
  packagesByEcosystem: Record<string, number>
  scoreDistribution: {
    critical: number
    high: number
    medium: number
    low: number
    unscored: number
  }
  activeViolations: number
  blockViolations: number
  lastSnapshotAt: string | null
  lastSnapshotId: string | null
}

export interface EcosystemBreakdown {
  ecosystem: string
  packageCount: number
  avgCompositeScore: number
  maxCompositeScore: number
  criticalCount: number
  advisoryCount: number
  topRiskyPackage: { name: string; score: number } | null
}

export interface PortfolioTrendPoint {
  snapshotId: string
  label: string | null
  snapshottedAt: string
  avgCompositeScore: number | null
  maxCompositeScore: number | null
  packageCount: number
  violationCount: number | null
}

// ─── Portfolio API functions ──────────────────────────────────────────────────

export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  const res = await apiClient.get<{ data: PortfolioSummary }>('/portfolio/summary')
  return res.data.data
}

export async function fetchTopRiskyPackages(params?: {
  ecosystem?: string
  limit?: number
}): Promise<PackageSummary[]> {
  const res = await apiClient.get<{ data: PackageSummary[] }>('/portfolio/top-risky', { params })
  return res.data.data
}

export async function fetchPortfolioChokepoints(params?: {
  ecosystem?: string
  limit?: number
}): Promise<ChokepointResult[]> {
  const res = await apiClient.get<{ data: ChokepointResult[] }>('/portfolio/chokepoints', { params })
  return res.data.data
}

export async function fetchEcosystemBreakdown(): Promise<EcosystemBreakdown[]> {
  const res = await apiClient.get<{ data: EcosystemBreakdown[] }>('/portfolio/ecosystem-breakdown')
  return res.data.data
}

export async function fetchPortfolioTrend(limit?: number): Promise<PortfolioTrendPoint[]> {
  const res = await apiClient.get<{ data: PortfolioTrendPoint[] }>('/portfolio/trend', {
    params: limit !== undefined ? { limit } : undefined,
  })
  return res.data.data
}

// ─── Alerting types ───────────────────────────────────────────────────────────

export type AlertType = 'new_vulnerability' | 'maintainer_collapse' | 'score_spike' | 'bus_factor_one'
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface DepgraphAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  packageId: string | null
  packageName: string | null
  ecosystem: string | null
  title: string
  message: string
  metadata: Record<string, unknown>
  snapshotId: string | null
  createdAt: string
  deduplicationKey: string
}

// ─── Alerting API functions ───────────────────────────────────────────────────

export async function fetchAlerts(params?: {
  limit?: number
  type?: AlertType
  since?: number
}): Promise<DepgraphAlert[]> {
  const res = await apiClient.get<{ data: DepgraphAlert[] }>('/alerts', { params })
  return res.data.data
}

export async function fetchAlertCount(): Promise<number> {
  const res = await apiClient.get<{ data: { count: number } }>('/alerts/count')
  return res.data.data.count
}

export async function fetchChokepoints(params?: {
  ecosystem?: string
  limit?: number
}): Promise<ChokepointResult[]> {
  const res = await apiClient.get<{ data: Array<{ packageId: string; name: string; ecosystem: string; centralityScore: number }> }>(
    '/graph/chokepoints',
    { params }
  )
  return res.data.data.map((cp) => ({
    packageId: cp.packageId,
    packageName: cp.name,
    ecosystem: cp.ecosystem,
    centralityScore: cp.centralityScore,
  }))
}
