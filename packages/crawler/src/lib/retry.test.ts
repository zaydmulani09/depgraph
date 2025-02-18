import { describe, it, expect, vi } from 'vitest'
import { withRetry } from './retry'

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on failure and succeeds on 2nd attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('server error'), { statusCode: 500 }))
      .mockResolvedValue('ok')
    const result = await withRetry(fn, { baseDelayMs: 10 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting all attempts', async () => {
    const err = Object.assign(new Error('always fails'), { statusCode: 503 })
    const fn = vi.fn().mockRejectedValue(err)
    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 })
    ).rejects.toThrow('always fails')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('shouldRetry: () => false does not retry', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nope'))
    await expect(
      withRetry(fn, { shouldRetry: () => false })
    ).rejects.toThrow('nope')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
