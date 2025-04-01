import type { TrendResult } from './trend-detector'

export interface AbandonmentSignal {
  name: string
  weight: number
  contribution: number
  description: string
}

export interface AbandonmentScore {
  packageId: string
  probability: number
  confidence: 'high' | 'medium' | 'low'
  signals: AbandonmentSignal[]
  recommendation: 'monitor' | 'warn' | 'critical'
}

// ─── Scorer ───────────────────────────────────────────────────────────────────

export function scoreAbandonment(
  packageId: string,
  latestSignals: Map<string, number>,
  trends: Map<string, TrendResult>
): AbandonmentScore {
  let realDataCount = 0

  // ── Signal 1: Days since last commit (weight 30%) ─────────────────────────
  const daysSinceCommit = latestSignals.get('days_since_last_commit')
  const hasCommitDate = daysSinceCommit !== undefined
  if (hasCommitDate) realDataCount++

  const days = daysSinceCommit ?? 999
  let commitScore: number
  if (days <= 30) commitScore = 0.0
  else if (days <= 90) commitScore = 0.2
  else if (days <= 180) commitScore = 0.5
  else if (days <= 365) commitScore = 0.8
  else commitScore = 1.0

  const sig1: AbandonmentSignal = {
    name: 'days_since_last_commit',
    weight: 0.3,
    contribution: 0,
    description: `Last commit ${Math.round(days)} days ago`,
  }

  // ── Signal 2: Commit frequency trend (weight 25%) ────────────────────────
  const commitTrend = trends.get('commit_frequency_30d')
  const hasCommitTrend = commitTrend !== undefined && commitTrend.direction !== 'insufficient_data'
  if (hasCommitTrend) realDataCount++

  let freqScore: number
  let freqDesc: string
  if (!commitTrend || commitTrend.direction === 'insufficient_data') {
    freqScore = 0.2
    freqDesc = 'Commit frequency insufficient data'
  } else if (
    commitTrend.direction === 'decreasing' &&
    commitTrend.percentChange !== null &&
    commitTrend.percentChange < -50
  ) {
    freqScore = 0.8
    freqDesc = `Commit frequency decreasing, ${commitTrend.percentChange.toFixed(0)}% change`
  } else if (
    commitTrend.direction === 'decreasing' &&
    commitTrend.percentChange !== null &&
    commitTrend.percentChange < -20
  ) {
    freqScore = 0.5
    freqDesc = `Commit frequency decreasing, ${commitTrend.percentChange.toFixed(0)}% change`
  } else if (commitTrend.direction === 'stable') {
    freqScore = 0.2
    freqDesc = `Commit frequency stable`
  } else if (commitTrend.direction === 'increasing') {
    freqScore = 0.0
    freqDesc = `Commit frequency increasing`
  } else {
    freqScore = 0.2
    freqDesc = `Commit frequency ${commitTrend.direction}`
  }

  const sig2: AbandonmentSignal = {
    name: 'commit_frequency_trend',
    weight: 0.25,
    contribution: 0,
    description: freqDesc,
  }

  // ── Signal 3: Active maintainer count (weight 25%) ────────────────────────
  const maintainerCount = latestSignals.get('active_maintainer_count')
  const hasMaintainerData = maintainerCount !== undefined
  if (hasMaintainerData) realDataCount++

  const count = maintainerCount ?? 1
  let maintainerBase: number
  if (count >= 4) maintainerBase = 0.0
  else if (count === 3) maintainerBase = 0.2
  else if (count === 2) maintainerBase = 0.4
  else maintainerBase = 0.7

  // Declining trend bonus
  const maintainerTrend = trends.get('active_maintainer_count')
  if (maintainerTrend?.direction === 'decreasing') {
    maintainerBase = Math.min(1.0, maintainerBase + 0.2)
  }

  const sig3: AbandonmentSignal = {
    name: 'active_maintainer_count',
    weight: 0.25,
    contribution: 0,
    description: `${Math.round(count)} active maintainer${count !== 1 ? 's' : ''}`,
  }

  // ── Signal 4: Bus factor (weight 20%) ────────────────────────────────────
  const busFactor = latestSignals.get('bus_factor')
  const hasBusData = busFactor !== undefined
  if (hasBusData) realDataCount++

  const bf = busFactor ?? 1
  let busScore: number
  if (bf >= 3) busScore = 0.0
  else if (bf === 2) busScore = 0.4
  else busScore = 0.8

  const sig4: AbandonmentSignal = {
    name: 'bus_factor',
    weight: 0.2,
    contribution: 0,
    description: `Bus factor: ${Math.round(bf)}`,
  }

  // ── Aggregate ─────────────────────────────────────────────────────────────
  const scores = [
    { sig: sig1, score: commitScore },
    { sig: sig2, score: freqScore },
    { sig: sig3, score: maintainerBase },
    { sig: sig4, score: busScore },
  ]

  const probability = scores.reduce((sum, { sig, score }) => sum + score * sig.weight, 0)

  // Compute contributions
  for (const { sig, score } of scores) {
    sig.contribution = probability > 0 ? (score * sig.weight) / probability : 0
  }

  // Confidence
  let confidence: 'high' | 'medium' | 'low'
  if (realDataCount >= 4) confidence = 'high'
  else if (realDataCount >= 2) confidence = 'medium'
  else confidence = 'low'

  // Recommendation
  let recommendation: 'monitor' | 'warn' | 'critical'
  if (probability >= 0.7) recommendation = 'critical'
  else if (probability >= 0.4) recommendation = 'warn'
  else recommendation = 'monitor'

  return {
    packageId,
    probability,
    confidence,
    signals: [sig1, sig2, sig3, sig4],
    recommendation,
  }
}
