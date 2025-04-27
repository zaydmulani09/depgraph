import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@depgraph/db/src/schema'
import type { db as DbType } from '@depgraph/db'

export function isSqliteMode(): boolean {
  return (
    (process.env.DATABASE_URL ?? '').startsWith('sqlite:') ||
    !!process.env.FILE_DB
  )
}

export async function createSqliteDb(): Promise<typeof DbType> {
  const url = process.env.DATABASE_URL ?? ':memory:'
  const filePath = url.replace('sqlite:', '')
  const sqlite = new Database(filePath)
  // Cast: SQLite drizzle instance used as dev stand-in for the PG db type
  return drizzle(sqlite, { schema }) as unknown as typeof DbType
}

export async function runSqliteMigrations(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _db: ReturnType<typeof drizzle>
): Promise<void> {
  console.warn(
    '[depgraph] SQLite mode: schema must be manually created. ' +
      'Run db:migrate with a compatible SQLite schema first.'
  )
}
