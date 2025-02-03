import type { Config } from 'drizzle-kit'

export default {
  schema: './src/schema.ts',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL ?? 'postgresql://depgraph:depgraph@localhost:5432/depgraph',
  },
} satisfies Config
