import type { DepgraphAlert, AlertConfig, AlertDelivery } from './types'
import { AlertDeduplicator } from './deduplicator'
import { deliverWebhook } from './webhook-deliverer'
import { deliverEmail } from './email-deliverer'

export interface DispatchResult {
  total: number
  delivered: number
  deduplicated: number
  failed: number
  byType: Record<string, { delivered: number; failed: number }>
}

export class AlertDispatcher {
  constructor(
    private config: AlertConfig,
    private deduplicator: AlertDeduplicator
  ) {}

  async dispatch(alerts: DepgraphAlert[]): Promise<DispatchResult> {
    const result: DispatchResult = {
      total: alerts.length,
      delivered: 0,
      deduplicated: 0,
      failed: 0,
      byType: {},
    }

    const fresh = await this.deduplicator.filterDuplicates(alerts, this.config.rules)
    result.deduplicated = alerts.length - fresh.length

    for (const alert of fresh) {
      const rule = this.config.rules.find((r) => r.type === alert.type)
      const deliveries: AlertDelivery[] = rule?.delivery ?? ['log_only']

      if (!result.byType[alert.type]) {
        result.byType[alert.type] = { delivered: 0, failed: 0 }
      }

      let anyDelivered = false
      let anyFailed = false

      for (const method of deliveries) {
        if (method === 'log_only') {
          console.log(
            `[alert] [${alert.severity.toUpperCase()}] ${alert.type}: ${alert.title} — ${alert.message}`
          )
          anyDelivered = true
        } else if (method === 'webhook') {
          const res = await deliverWebhook(alert, this.config.webhook)
          if (res.success) {
            anyDelivered = true
          } else {
            console.error(`[alert] webhook delivery failed: ${res.error}`)
            anyFailed = true
          }
        } else if (method === 'email') {
          const res = await deliverEmail(alert, this.config.email)
          if (res.success) {
            anyDelivered = true
          } else {
            console.error(`[alert] email delivery failed: ${res.error}`)
            anyFailed = true
          }
        }
      }

      if (anyDelivered) {
        result.delivered++
        result.byType[alert.type].delivered++
        await this.deduplicator.markSent(alert, rule?.throttleMinutes ?? 60)
      }
      if (anyFailed) {
        result.failed++
        result.byType[alert.type].failed++
      }
    }

    return result
  }
}
