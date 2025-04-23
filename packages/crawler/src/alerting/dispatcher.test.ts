import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AlertDispatcher } from './dispatcher'
import { AlertDeduplicator } from './deduplicator'
import type { DepgraphAlert, AlertConfig } from './types'
import { DEFAULT_ALERT_RULES } from './types'

vi.mock('./webhook-deliverer', () => ({
  deliverWebhook: vi.fn().mockResolvedValue({ success: true, statusCode: 200 }),
}))
vi.mock('./email-deliverer', () => ({
  deliverEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
}))

import { deliverWebhook } from './webhook-deliverer'
import { deliverEmail } from './email-deliverer'

function makeAlert(overrides: Partial<DepgraphAlert> = {}): DepgraphAlert {
  return {
    id: 'alert-1',
    type: 'score_spike',
    severity: 'high',
    packageId: 'pkg-1',
    packageName: 'lodash',
    ecosystem: 'npm',
    title: 'Score spike',
    message: 'Score increased',
    metadata: {},
    snapshotId: 'snap-1',
    createdAt: new Date().toISOString(),
    deduplicationKey: 'score_spike:pkg-1:10',
    ...overrides,
  }
}

function makeMockDedup(isDup = false): AlertDeduplicator {
  return {
    filterDuplicates: vi.fn().mockImplementation(async (alerts: DepgraphAlert[]) =>
      isDup ? [] : alerts
    ),
    markSent: vi.fn().mockResolvedValue(undefined),
    isDuplicate: vi.fn().mockResolvedValue(isDup),
  } as unknown as AlertDeduplicator
}

describe('AlertDispatcher', () => {
  it('returns zero delivered when all alerts are duplicates', async () => {
    const config: AlertConfig = { rules: DEFAULT_ALERT_RULES }
    const dedup = makeMockDedup(true)
    const dispatcher = new AlertDispatcher(config, dedup)
    const result = await dispatcher.dispatch([makeAlert()])
    expect(result.delivered).toBe(0)
    expect(result.deduplicated).toBe(1)
  })

  it('delivers via log_only for score_spike by default', async () => {
    const config: AlertConfig = { rules: DEFAULT_ALERT_RULES }
    const dedup = makeMockDedup(false)
    const dispatcher = new AlertDispatcher(config, dedup)
    const result = await dispatcher.dispatch([makeAlert()])
    expect(result.delivered).toBe(1)
    expect(result.failed).toBe(0)
  })

  it('calls deliverWebhook when webhook delivery configured', async () => {
    const config: AlertConfig = {
      rules: [{ type: 'score_spike', enabled: true, severity: 'high', delivery: ['webhook'], throttleMinutes: 60 }],
      webhook: { url: 'https://hooks.example.com/test' },
    }
    const dedup = makeMockDedup(false)
    const dispatcher = new AlertDispatcher(config, dedup)
    await dispatcher.dispatch([makeAlert()])
    expect(deliverWebhook).toHaveBeenCalledWith(expect.objectContaining({ type: 'score_spike' }), config.webhook)
  })

  it('calls deliverEmail when email delivery configured', async () => {
    const emailConfig = {
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpUser: 'user',
      smtpPass: 'pass',
      from: 'from@example.com',
      to: ['to@example.com'],
    }
    const config: AlertConfig = {
      rules: [{ type: 'score_spike', enabled: true, severity: 'high', delivery: ['email'], throttleMinutes: 60 }],
      email: emailConfig,
    }
    const dedup = makeMockDedup(false)
    const dispatcher = new AlertDispatcher(config, dedup)
    await dispatcher.dispatch([makeAlert()])
    expect(deliverEmail).toHaveBeenCalledWith(expect.objectContaining({ type: 'score_spike' }), emailConfig)
  })

  it('marks alert as sent after successful delivery', async () => {
    const config: AlertConfig = { rules: DEFAULT_ALERT_RULES }
    const dedup = makeMockDedup(false)
    const dispatcher = new AlertDispatcher(config, dedup)
    const alert = makeAlert()
    await dispatcher.dispatch([alert])
    expect(dedup.markSent).toHaveBeenCalledWith(alert, expect.any(Number))
  })

  it('tracks byType breakdown', async () => {
    const config: AlertConfig = { rules: DEFAULT_ALERT_RULES }
    const dedup = makeMockDedup(false)
    const dispatcher = new AlertDispatcher(config, dedup)
    const alerts = [
      makeAlert({ id: '1', deduplicationKey: 'a' }),
      makeAlert({ id: '2', type: 'new_vulnerability', deduplicationKey: 'b' }),
    ]
    const result = await dispatcher.dispatch(alerts)
    expect(result.byType['score_spike']).toBeDefined()
    expect(result.byType['new_vulnerability']).toBeDefined()
  })
})
