export function riskColor(score: number | undefined): string {
  if (score === undefined || score === 0) return '#55556a'
  if (score >= 75) return '#ff4466'
  if (score >= 50) return '#ff8833'
  if (score >= 25) return '#ffcc22'
  return '#44cc88'
}

export function riskLabel(score: number | undefined): string {
  if (score === undefined) return 'unscored'
  if (score >= 75) return 'critical'
  if (score >= 50) return 'high'
  if (score >= 25) return 'medium'
  return 'low'
}
