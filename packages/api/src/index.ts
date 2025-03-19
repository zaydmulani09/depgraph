import { serve } from '@hono/node-server'
import { app } from './app'

const port = Number(process.env.API_PORT ?? 3001)

serve({ fetch: app.fetch, port }, () => {
  console.log(`[depgraph-api] Server running on http://localhost:${port}`)
})
