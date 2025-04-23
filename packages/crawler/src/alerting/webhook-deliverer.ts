import { request } from 'undici'
import { createHmac } from 'node:crypto'
import type { DepgraphAlert, AlertConfig } from './types'

export async function deliverWebhook(
  alert: DepgraphAlert,
  config: AlertConfig['webhook']
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  if (!config) return { success: false, error: 'No webhook config' }

  try {
    const body = JSON.stringify(alert)
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-depgraph-event': alert.type,
      'x-depgraph-alert-id': alert.id,
    }

    if (config.secret) {
      const sig = createHmac('sha256', config.secret).update(body).digest('hex')
      headers['x-depgraph-signature'] = `sha256=${sig}`
    }

    const timeout = config.timeoutMs ?? 5000
    const res = await request(config.url, {
      method: 'POST',
      headers,
      body,
      bodyTimeout: timeout,
      headersTimeout: timeout,
    })

    await res.body.text()

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return { success: true, statusCode: res.statusCode }
    }
    return { success: false, statusCode: res.statusCode, error: `HTTP ${res.statusCode}` }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
