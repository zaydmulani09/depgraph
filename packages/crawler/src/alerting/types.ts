export type AlertType =
  | 'new_vulnerability'
  | 'maintainer_collapse'
  | 'score_spike'
  | 'bus_factor_one'

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'

export type AlertDelivery = 'webhook' | 'email' | 'log_only'

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

export interface AlertRule {
  type: AlertType
  enabled: boolean
  severity: AlertSeverity
  delivery: AlertDelivery[]
  throttleMinutes: number
}

export interface AlertConfig {
  rules: AlertRule[]
  webhook?: {
    url: string
    secret?: string
    timeoutMs?: number
  }
  email?: {
    smtpHost: string
    smtpPort: number
    smtpUser: string
    smtpPass: string
    from: string
    to: string[]
  }
}

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    type: 'new_vulnerability',
    enabled: true,
    severity: 'high',
    delivery: ['webhook', 'log_only'],
    throttleMinutes: 60,
  },
  {
    type: 'maintainer_collapse',
    enabled: true,
    severity: 'critical',
    delivery: ['webhook', 'log_only'],
    throttleMinutes: 1440,
  },
  {
    type: 'score_spike',
    enabled: true,
    severity: 'medium',
    delivery: ['log_only'],
    throttleMinutes: 120,
  },
  {
    type: 'bus_factor_one',
    enabled: true,
    severity: 'high',
    delivery: ['log_only'],
    throttleMinutes: 720,
  },
]
