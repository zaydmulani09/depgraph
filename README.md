# depgraph

**Open-source dependency intelligence platform — risk scoring, graph analysis, and supply chain security for npm, PyPI, and Cargo.**

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Tests: 457 passing](https://img.shields.io/badge/tests-457%20passing-brightgreen.svg)

<!-- screenshot -->

## What it does

- **Crawls** npm, PyPI, and Cargo registries continuously, building a live dependency graph across all three ecosystems
- **Scores** every package across 6 risk dimensions (security, maintenance, compatibility, concentration, blast radius, operational) with a weighted composite score
- **Alerts** when packages drift — new vulnerabilities, maintainer collapse, score spikes, and bus-factor-one conditions detected automatically
- **Visualizes** the full supply chain via an interactive graph explorer, portfolio dashboard, and historical diff viewer so teams can track risk over time

## Tech stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript (strict mode)
- **Monorepo**: pnpm workspaces
- **Backend**: Hono + @hono/node-server
- **Queue**: BullMQ + ioredis
- **Database**: PostgreSQL 16 + Drizzle ORM
- **Object storage**: MinIO (self-hosted S3-compatible)
- **Frontend**: React 18 + Vite + Recharts + Cytoscape.js + TanStack Query
- **Testing**: Vitest (457 tests)
- **Containers**: Docker Compose

## Quick start

```bash
# 1. Clone
git clone https://github.com/zaydmulani09/depgraph.git
cd depgraph

# 2. Install
pnpm install

# 3. Start infrastructure
docker compose up -d

# 4. Migrate database
pnpm db:migrate

# 5. Copy env and configure
cp .env.example .env

# 6. Start all services
pnpm --filter @depgraph/crawler dev &
pnpm --filter @depgraph/api dev &
pnpm --filter @depgraph/ui dev
```

Open `http://localhost:5173` for the UI and `http://localhost:3001` for the API.

**Offline / local dev** (no PostgreSQL required):

```bash
DATABASE_URL=sqlite:./depgraph.db pnpm --filter @depgraph/crawler tsx src/index.ts --seed-fixtures
```

Or run the full benchmark suite against fixture data:

```bash
pnpm benchmark
```

## Architecture

depgraph is a monorepo with six packages. `@depgraph/crawler` drives all data acquisition: three registry crawlers (npm, PyPI, Cargo) fan out jobs through BullMQ queues, normalize raw responses into a unified schema, and persist to PostgreSQL via Drizzle. A GitHub ingestion pipeline enriches packages with commit/maintainer signals; an OSV.dev integration populates advisories. `@depgraph/risk` computes six-dimension risk scores from the live DB state; `@depgraph/api` exposes the data over a Hono REST API; `@depgraph/ui` renders the React frontend. Snapshots are taken daily and diffed to power the drift-detection alerting system.


## Contributing

This is a personal project. PRs welcome.

## License

MIT
