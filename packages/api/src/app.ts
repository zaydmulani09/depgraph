import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { rateLimitMiddleware } from './middleware/rate-limit'
import { apiKeyAuth } from './middleware/auth'
import { err } from './lib/response'
import { healthRouter } from './routes/health'
import { packagesRouter } from './routes/packages'
import { snapshotsRouter } from './routes/snapshots'
import { policyRouter } from './routes/policy'
import { simulatorRouter } from './routes/simulator'
import { graphRouter } from './routes/graph'
import { portfolioRouter } from './routes/portfolio'
import { alertsRouter } from './routes/alerts'
import { openApiRouter } from './routes/openapi'

const app = new Hono()

// Global middleware
app.use('*', cors({ origin: ['http://localhost:5173'], credentials: true }))
app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', rateLimitMiddleware({ windowMs: 60_000, maxRequests: 200 }))

// Public routes
app.route('/health', healthRouter)
app.route('/openapi.json', openApiRouter)

// Protected routes
app.use('/packages/*', apiKeyAuth)
app.route('/packages', packagesRouter)

app.use('/snapshots/*', apiKeyAuth)
app.route('/snapshots', snapshotsRouter)

app.use('/policy/*', apiKeyAuth)
app.route('/policy', policyRouter)

app.use('/simulate/*', apiKeyAuth)
app.route('/simulate', simulatorRouter)

app.use('/graph/*', apiKeyAuth)
app.route('/graph', graphRouter)

app.use('/portfolio/*', apiKeyAuth)
app.route('/portfolio', portfolioRouter)

app.use('/alerts/*', apiKeyAuth)
app.route('/alerts', alertsRouter)

// 404 fallback
app.notFound((c) => err(c, 'Route not found', 404, 'NOT_FOUND'))

// Global error handler
app.onError((error, c) => {
  console.error('[api] Unhandled error:', error)
  return err(c, 'Internal server error', 500, 'INTERNAL_ERROR')
})

export { app }
