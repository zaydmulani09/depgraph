# Prompt Engineer Handoff

## What this project is
depgraph — a dependency intelligence platform. TypeScript monorepo.
Crawls npm/PyPI/Cargo, builds a live risk-scored dependency graph,
provides a UI for supply chain analysis.

## Full tech stack
- Runtime: Node.js 20+
- Language: TypeScript (strict mode)
- Monorepo: pnpm workspaces
- Backend: Hono + @hono/node-server
- Queue: BullMQ + ioredis
- Database: PostgreSQL 16 (primary) + Drizzle ORM
- Object storage: MinIO (self-hosted S3-compatible)
- Frontend: React 18 + Vite + Recharts + Cytoscape.js + TanStack Query
- Testing: Vitest
- Containers: Docker Compose
- Package manager: pnpm

## Prompt status
| Prompt | Title | Status |
|--------|-------|--------|
| P1 | Repo scaffold + CONTEXT.md | ✅ Done |
| P2 | Database schema | ✅ Done |
| P3 | npm registry crawler | ✅ Done |
| P4 | GitHub metadata + maintainer signals | ✅ Done |
| P5 | OSV.dev advisory ingestion | ✅ Done |
| P6 | Risk engine v1 | ✅ Done |
| P7 | Transitive graph + blast radius | ✅ Done |
| P8 | Snapshot system | ✅ Done |
| P9 | Policy engine | ✅ Done |
| P10 | Upgrade simulator | ✅ Done |
| P11 | REST API | ✅ Done |
| P12 | React frontend v1 | ✅ Done |
| P13 | Graph explorer UI | ✅ Done |
| P14 | Historical diff viewer + policy UI | ✅ Done |
| P15 | Time-series signals + abandonment detector | ✅ Done |
| P16 | Forecasting UI | ✅ Done |
| P17 | PyPI crawler | ✅ Done |
| P18 | Cargo crawler | ✅ Done |
| P19 | Cross-ecosystem normalization | ✅ Done |
| P20 | Portfolio risk dashboard | ✅ Done |
| P21 | CI gate GitHub Action | ✅ Done |
| P22 | Drift detection + alerting | ✅ Done |
| P23 | Benchmark suite + local dev mode | ✅ Done |
| P24 | Git history + GitHub push | ⬜ Next |

## Current file tree
```
depgraph/
├── .env
├── .env.example
├── .eslintrc.json
├── .gitignore
├── .npmrc
├── .prettierrc
├── docker-compose.yml
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.config.ts
└── packages/
    ├── api/src/{index.ts, app.ts, lib/{response,validate}.ts, middleware/{auth,auth.test,rate-limit,rate-limit.test}.ts, routes/{health,health.test,packages,snapshots,policy,simulator,graph,portfolio,portfolio.test,alerts,openapi}.ts}
    ├── action/src/{index,manifest-parser,manifest-parser.test,api-client,comment-formatter,comment-formatter.test,exit-codes,exit-codes.test}.ts + action.yml
    ├── .github/workflows/{depgraph,test}.yml
    ├── ui/src/{main.tsx, App.tsx, styles/globals.css, lib/{api,query-client,risk-colors,cytoscape-styles}.ts, hooks/{usePackages,useSnapshots,useGraph,useDiff,usePolicy,usePortfolio,useAlerts}.ts, components/{RiskBadge,EcosystemBadge,ScoreBar,LoadingSpinner,ErrorMessage,Layout,ActionBadge,AlertFeed}.tsx, components/graph/{NodeDetailPanel,GraphControls}.tsx, components/diff/{DiffSummaryBar,DiffPackageRow,VulnChainAlert}.tsx, components/forecasting/{AbandonmentGauge,RiskSparkline,ForecastWidget,MaintainerTimeline}.tsx, components/portfolio/{ScoreDistributionChart,EcosystemCard,PortfolioTrendChart,ChokepointTable}.tsx, pages/{Dashboard,PackageList,PackageDetail,SnapshotList,SnapshotDiff,GraphExplorer,PolicyViolations,PolicyRules,Portfolio}.tsx}
    ├── crawler/src/{index.ts, alerting/{types,deduplicator,deduplicator.test,store,webhook-deliverer,email-deliverer,dispatcher,dispatcher.test,drift-detector,drift-detector.test}.ts, analysis/{timeseries,trend-detector,trend-detector.test,abandonment-scorer,abandonment-scorer.test,bus-factor-alert,backfill}.ts, benchmarks/{offline-seed,sqlite-mode,crawler-benchmark,crawler-benchmark.test,scoring-benchmark,scoring-benchmark.test,runner}.ts, fixtures/{loader,loader.test}.ts + fixtures/npm/{react,lodash,express}.json + fixtures/pypi/{requests,numpy,django}.json + fixtures/cargo/{serde,serde-deps,tokio,tokio-deps}.json, graph/{traversal,traversal.test,resolver,consumer-populator,consumer-populator.test}.ts, snapshots/{types,builder,builder.test,persister,differ,differ.test,scheduler}.ts, policy/{types,evaluator,evaluator.test,remediation,builtin-rules,seeder,engine,engine.test,writer}.ts, simulator/{types,semver,semver.test,transitive-diff,transitive-diff.test,simulator}.ts, lib/{rate-limiter,retry,dedup,storage}.ts, integrations/{github/{client,signals,repo-parser,identity-linker},osv/{client,cursor,normalizer,severity-parser}}.ts, queue/index.ts, registries/npm/{client,normalizer}.ts, registries/pypi/{client,pep440,pep440.test,pep508,pep508.test,normalizer,normalizer.test}.ts, registries/cargo/{client,version-req,version-req.test,toml-parser,toml-parser.test,normalizer,normalizer.test}.ts, normalization/{adapter,version-normalizer,version-normalizer.test,range-normalizer,range-normalizer.test,identity-resolver,chokepoint-detector,index}.ts normalization/adapters/{npm,pypi,cargo}-adapter.ts, workers/{analysis,npm-crawl,npm-process,pypi-crawl,pypi-process,cargo-crawl,cargo-process,github-ingest,osv-ingest,graph-populate,snapshot,simulator}.worker.ts}
    ├── db/src/{client.ts,index.ts,schema.ts,schema.test.ts} + drizzle.config.ts
    ├── risk/src/{index.ts, types.ts, aggregator.ts, aggregator.test.ts, engine.ts, graph.ts, writer.ts, dimensions/{security,security.test,maintenance,maintenance.test,compatibility,concentration,blast-radius,operational}.ts}
    ├── shared/src/{index.ts,index.test.ts}
    └── ui/src/main.tsx + index.html + vite.config.ts
```

## Test count
457 passing, 0 failing

## Known issues
- pnpm 11: use `--ignore-scripts` flag on all `pnpm add` / `pnpm install` calls.
  pnpm 11 no longer reads `"pnpm"` field in package.json for build config.
  esbuild native binary won't compile but JS fallback works fine for Vitest.
- `@depgraph/crawler` now explicitly depends on `drizzle-orm` and `@depgraph/db`.

## What P22 covers
Drift detection + alerting — AlertDeduplicator (Redis TTL), AlertStore (Redis sorted set, max 500), webhook-deliverer (undici + HMAC-SHA256), email-deliverer (nodemailer), AlertDispatcher (routes to webhook/email/log_only, deduplication, DispatchResult). detectDrift: 7-day baseline diff → 4 alert types (new_vulnerability, score_spike, maintainer_collapse, bus_factor_one). snapshot.worker updated to run drift detection after full snapshots. AlertConfig from 8 env vars. Alerts API (GET /alerts, GET /alerts/count, DELETE /alerts). DepgraphAlert types + fetch fns in UI api.ts. useAlerts hook (30s refetch). AlertFeed component (severity-colored cards, relative time). Dashboard 5th section. 19 new tests.

## What P23 covers
Benchmark suite + local dev mode — Fixture data: 10 pre-crawled package JSON files (3 npm, 3 pypi, 4 cargo including deps files) for offline operation. Fixture loader: loadFixture, listFixtures, loadAllFixtures (ESM-safe path resolution). Offline seed: seedFromFixtures writes fixture data to DB via real normalizers, clearFixtureData removes them. SQLite mode: isSqliteMode() detection, createSqliteDb() using better-sqlite3 + drizzle. Crawler throughput benchmark: measures packages/sec, cache hit rate, API error rate, works with fixtures or real network. Risk scoring benchmark: measures scoring throughput, consistency across runs (max variance), explanation coverage. Benchmark runner CLI with formatted table output. `pnpm benchmark` root script. `--seed-fixtures` flag in crawler entrypoint. SQLite env example in .env.example.

## What P24 covers
Git history + GitHub push — spread all commits across 4 months with realistic timestamps using GIT_AUTHOR_DATE and GIT_COMMITTER_DATE, conventional commit messages, logical commit groupings by feature, release tag v0.1.0, push to zaydmulani09/depgraph via gh CLI. All commits authored as Zayd Mulani (zaydmulani@gmail.com). Never set Claude Code as author.

## How to start a new session
Paste the following at the start of your Claude Code session:

> Read CONTEXT.md and PROMPT_ENGINEER_HANDOFF.md in full.
> Then read the current file tree.
> We are on P24. Do not start until I paste the prompt.
