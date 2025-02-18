export interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  shouldRetry?: (err: unknown) => boolean
}

function isNetworkOrRateError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('network') || msg.includes('econnreset') || msg.includes('enotfound')) {
      return true
    }
  }
  // Check for HTTP status errors
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const status = (err as { statusCode: number }).statusCode
    return [429, 500, 502, 503, 504].includes(status)
  }
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: number }).status
    return [429, 500, 502, 503, 504].includes(status)
  }
  return false
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 10000,
    shouldRetry = isNetworkOrRateError,
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt === maxAttempts - 1) break
      if (!shouldRetry(err)) break

      const jitter = Math.random() * 200
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt) + jitter, maxDelayMs)
      console.log(`[retry] Attempt ${attempt + 1} failed. Retrying in ${Math.round(delay)}ms...`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  throw lastError
}
