import type { Queue } from 'bullmq'

function parseDailyCron(cron: string): { hour: number; minute: number } {
  const parts = cron.trim().split(/\s+/)
  const minute = parseInt(parts[0], 10)
  const hour = parseInt(parts[1], 10)
  return { hour, minute }
}

function msUntilNext(hour: number, minute: number): number {
  const now = new Date()
  const target = new Date(now)
  target.setHours(hour, minute, 0, 0)
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1)
  }
  return target.getTime() - now.getTime()
}

export function startSnapshotScheduler(
  snapshotQueue: Queue,
  options?: {
    fullSnapshotCron?: string
    enabled?: boolean
  }
): { stop: () => void } {
  const enabled = options?.enabled ?? true
  if (!enabled) return { stop: () => {} }

  const cron = options?.fullSnapshotCron ?? '0 2 * * *'
  const { hour, minute } = parseDailyCron(cron)

  const nextDate = new Date()
  const msDelay = msUntilNext(hour, minute)
  nextDate.setTime(Date.now() + msDelay)

  console.log(`[scheduler] Next full snapshot scheduled for ${nextDate.toISOString()}`)

  let intervalHandle: ReturnType<typeof setInterval> | null = null

  const timeoutHandle = setTimeout(async () => {
    await snapshotQueue.add('snapshot', { mode: 'full' })
    console.log('[scheduler] Full snapshot job enqueued')

    intervalHandle = setInterval(async () => {
      await snapshotQueue.add('snapshot', { mode: 'full' })
      console.log('[scheduler] Full snapshot job enqueued')
    }, 24 * 60 * 60 * 1000)
  }, msDelay)

  return {
    stop: () => {
      clearTimeout(timeoutHandle)
      if (intervalHandle !== null) clearInterval(intervalHandle)
    },
  }
}
