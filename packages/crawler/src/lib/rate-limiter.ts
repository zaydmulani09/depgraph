export interface RateLimiterOptions {
  requestsPerSecond: number
}

export class RateLimiter {
  private tokens: number
  private lastRefill: number
  private readonly rate: number // tokens per ms
  private queue: Array<() => void> = []

  constructor({ requestsPerSecond }: RateLimiterOptions) {
    this.rate = requestsPerSecond / 1000
    this.tokens = requestsPerSecond
    this.lastRefill = Date.now()
  }

  private refill(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    this.tokens = Math.min(
      this.rate * 1000, // max = requestsPerSecond
      this.tokens + elapsed * this.rate
    )
    this.lastRefill = now
  }

  private flush(): void {
    while (this.queue.length > 0 && this.tokens >= 1) {
      this.tokens -= 1
      const resolve = this.queue.shift()!
      resolve()
    }
  }

  async throttle(): Promise<void> {
    this.refill()
    if (this.tokens >= 1) {
      this.tokens -= 1
      return
    }
    // Wait for a token
    await new Promise<void>((resolve) => {
      this.queue.push(resolve)
      const msPerToken = 1 / this.rate
      const scheduleFlush = () => {
        setTimeout(() => {
          this.refill()
          this.flush()
          if (this.queue.length > 0) scheduleFlush()
        }, msPerToken)
      }
      if (this.queue.length === 1) scheduleFlush()
    })
  }
}
