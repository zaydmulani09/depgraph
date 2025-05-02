# depgraph — Dependency Intelligence Platform

## What this is
A TypeScript monorepo that crawls npm, PyPI, and Cargo registries, builds a live
dependency graph, scores packages across 6 risk dimensions, and provides a UI for
exploring supply chain health. Fully open source, zero paid services.

## Tech stack
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

## Workspace packages
- @depgraph/shared — shared types and utilities
- @depgraph/db — Drizzle schema and migrations
- @depgraph/crawler — registry crawlers and BullMQ workers
- @depgraph/api — Hono REST API server
- @depgraph/risk — risk scoring engine
- @depgraph/ui — React + Vite frontend

## File tree
```
depgraph/
├── .env
├── .github/
│   └── workflows/
│       ├── depgraph.yml
│       └── test.yml
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
    ├── api/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vitest.config.ts
    │   └── src/
    │       ├── index.ts
    │       ├── app.ts
    │       ├── lib/
    │       │   ├── response.ts
    │       │   └── validate.ts
    │       ├── middleware/
    │       │   ├── auth.ts
    │       │   ├── auth.test.ts
    │       │   ├── rate-limit.ts
    │       │   └── rate-limit.test.ts
    │       └── routes/
    │           ├── health.ts
    │           ├── health.test.ts
    │           ├── packages.ts
    │           ├── snapshots.ts
    │           ├── policy.ts
    │           ├── simulator.ts
    │           ├── graph.ts
    │           ├── portfolio.ts
    │           ├── portfolio.test.ts
    │           ├── alerts.ts
    │           └── openapi.ts
    ├── ui/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vite.config.ts
    │   ├── index.html
    │   └── src/
    │       ├── main.tsx
    │       ├── App.tsx
    │       ├── styles/globals.css
    │       ├── lib/
    │       │   ├── api.ts
    │       │   ├── query-client.ts
    │       │   ├── risk-colors.ts
    │       │   └── cytoscape-styles.ts
    │       ├── components/
    │       │   ├── RiskBadge.tsx
    │       │   ├── EcosystemBadge.tsx
    │       │   ├── ScoreBar.tsx
    │       │   ├── LoadingSpinner.tsx
    │       │   ├── ErrorMessage.tsx
    │       │   ├── Layout.tsx
    │       │   ├── ActionBadge.tsx
    │       │   ├── AlertFeed.tsx
    │       │   ├── forecasting/
    │       │   │   ├── AbandonmentGauge.tsx
    │       │   │   ├── RiskSparkline.tsx
    │       │   │   ├── ForecastWidget.tsx
    │       │   │   └── MaintainerTimeline.tsx
    │       │   ├── graph/
    │       │   │   ├── NodeDetailPanel.tsx
    │       │   │   └── GraphControls.tsx
    │       │   ├── diff/
    │       │   │   ├── DiffSummaryBar.tsx
    │       │   │   ├── DiffPackageRow.tsx
    │       │   │   └── VulnChainAlert.tsx
    │       │   └── portfolio/
    │       │       ├── ScoreDistributionChart.tsx
    │       │       ├── EcosystemCard.tsx
    │       │       ├── PortfolioTrendChart.tsx
    │       │       └── ChokepointTable.tsx
    │       ├── hooks/
    │       │   ├── usePackages.ts
    │       │   ├── useSnapshots.ts
    │       │   ├── useGraph.ts
    │       │   ├── useDiff.ts
    │       │   ├── usePolicy.ts
    │       │   ├── usePortfolio.ts
    │       │   └── useAlerts.ts
    │       └── pages/
    │           ├── Dashboard.tsx
    │           ├── PackageList.tsx
    │           ├── PackageDetail.tsx
    │           ├── SnapshotList.tsx
    │           ├── SnapshotDiff.tsx
    │           ├── GraphExplorer.tsx
    │           ├── PolicyViolations.tsx
    │           ├── PolicyRules.tsx
    │           └── Portfolio.tsx
    ├── crawler/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vitest.config.ts
    │   └── src/
    │       ├── index.ts
    │       ├── graph/
    │       │   ├── traversal.ts
    │       │   ├── traversal.test.ts
    │       │   ├── resolver.ts
    │       │   ├── consumer-populator.ts
    │       │   └── consumer-populator.test.ts
    │       ├── policy/
    │       │   ├── types.ts
    │       │   ├── evaluator.ts
    │       │   ├── evaluator.test.ts
    │       │   ├── remediation.ts
    │       │   ├── builtin-rules.ts
    │       │   ├── seeder.ts
    │       │   ├── engine.ts
    │       │   ├── engine.test.ts
    │       │   └── writer.ts
    │       ├── snapshots/
    │       │   ├── types.ts
    │       │   ├── builder.ts
    │       │   ├── builder.test.ts
    │       │   ├── persister.ts
    │       │   ├── differ.ts
    │       │   ├── differ.test.ts
    │       │   └── scheduler.ts
    │       ├── lib/
    │       │   ├── dedup.ts
    │       │   ├── rate-limiter.ts
    │       │   ├── rate-limiter.test.ts
    │       │   ├── retry.ts
    │       │   ├── retry.test.ts
    │       │   └── storage.ts
    │       ├── integrations/
    │       │   ├── github/
    │       │   │   ├── client.ts
    │       │   │   ├── identity-linker.ts
    │       │   │   ├── repo-parser.ts
    │       │   │   ├── repo-parser.test.ts
    │       │   │   ├── signals.ts
    │       │   │   └── signals.test.ts
    │       │   └── osv/
    │       │       ├── client.ts
    │       │       ├── cursor.ts
    │       │       ├── normalizer.ts
    │       │       ├── normalizer.test.ts
    │       │       ├── severity-parser.ts
    │       │       └── severity-parser.test.ts
    │       ├── queue/index.ts
    │       ├── registries/npm/
    │       │   ├── client.ts
    │       │   ├── normalizer.ts
    │       │   └── normalizer.test.ts
    │       ├── registries/pypi/
    │       │   ├── client.ts
    │       │   ├── pep440.ts
    │       │   ├── pep440.test.ts
    │       │   ├── pep508.ts
    │       │   ├── pep508.test.ts
    │       │   ├── normalizer.ts
    │       │   └── normalizer.test.ts
    │       ├── registries/cargo/
    │       │   ├── client.ts
    │       │   ├── version-req.ts
    │       │   ├── version-req.test.ts
    │       │   ├── toml-parser.ts
    │       │   ├── toml-parser.test.ts
    │       │   ├── normalizer.ts
    │       │   └── normalizer.test.ts
    │       ├── normalization/
    │       │   ├── adapter.ts
    │       │   ├── version-normalizer.ts
    │       │   ├── version-normalizer.test.ts
    │       │   ├── range-normalizer.ts
    │       │   ├── range-normalizer.test.ts
    │       │   ├── identity-resolver.ts
    │       │   ├── chokepoint-detector.ts
    │       │   ├── index.ts
    │       │   └── adapters/
    │       │       ├── npm-adapter.ts
    │       │       ├── pypi-adapter.ts
    │       │       └── cargo-adapter.ts
    │       ├── simulator/
    │       │   ├── types.ts
    │       │   ├── semver.ts
    │       │   ├── semver.test.ts
    │       │   ├── transitive-diff.ts
    │       │   ├── transitive-diff.test.ts
    │       │   └── simulator.ts
    │       ├── analysis/
    │       │   ├── timeseries.ts
    │       │   ├── trend-detector.ts
    │       │   ├── trend-detector.test.ts
    │       │   ├── abandonment-scorer.ts
    │       │   ├── abandonment-scorer.test.ts
    │       │   ├── bus-factor-alert.ts
    │       │   └── backfill.ts
    │       ├── alerting/
    │       │   ├── types.ts
    │       │   ├── deduplicator.ts
    │       │   ├── deduplicator.test.ts
    │       │   ├── store.ts
    │       │   ├── webhook-deliverer.ts
    │       │   ├── email-deliverer.ts
    │       │   ├── dispatcher.ts
    │       │   ├── dispatcher.test.ts
    │       │   ├── drift-detector.ts
    │       │   └── drift-detector.test.ts
    │       ├── benchmarks/
    │       │   ├── offline-seed.ts
    │       │   ├── sqlite-mode.ts
    │       │   ├── crawler-benchmark.ts
    │       │   ├── crawler-benchmark.test.ts
    │       │   ├── scoring-benchmark.ts
    │       │   ├── scoring-benchmark.test.ts
    │       │   └── runner.ts
    │       ├── fixtures/
    │       │   ├── loader.ts
    │       │   ├── loader.test.ts
    │       │   ├── npm/react.json
    │       │   ├── npm/lodash.json
    │       │   ├── npm/express.json
    │       │   ├── pypi/requests.json
    │       │   ├── pypi/numpy.json
    │       │   ├── pypi/django.json
    │       │   ├── cargo/serde.json
    │       │   ├── cargo/serde-deps.json
    │       │   ├── cargo/tokio.json
    │       │   └── cargo/tokio-deps.json
    │       └── workers/
    │           ├── analysis.worker.ts
    │           ├── github-ingest.worker.ts
    │           ├── graph-populate.worker.ts
    │           ├── npm-crawl.worker.ts
    │           ├── npm-process.worker.ts
    │           ├── osv-ingest.worker.ts
    │           ├── cargo-crawl.worker.ts
    │           ├── cargo-process.worker.ts
    │           ├── pypi-crawl.worker.ts
    │           ├── pypi-process.worker.ts
    │           ├── simulator.worker.ts
    │           └── snapshot.worker.ts
    ├── db/
    │   ├── drizzle.config.ts
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vitest.config.ts
    │   └── src/
    │       ├── client.ts
    │       ├── index.ts
    │       ├── schema.ts
    │       └── schema.test.ts
    ├── risk/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vitest.config.ts
    │   └── src/
    │       ├── index.ts
    │       ├── types.ts
    │       ├── aggregator.ts
    │       ├── aggregator.test.ts
    │       ├── engine.ts
    │       ├── graph.ts
    │       ├── writer.ts
    │       └── dimensions/
    │           ├── security.ts
    │           ├── security.test.ts
    │           ├── maintenance.ts
    │           ├── maintenance.test.ts
    │           ├── compatibility.ts
    │           ├── concentration.ts
    │           ├── blast-radius.ts
    │           └── operational.ts
    ├── action/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vitest.config.ts
    │   ├── action.yml
    │   └── src/
    │       ├── index.ts
    │       ├── manifest-parser.ts
    │       ├── manifest-parser.test.ts
    │       ├── api-client.ts
    │       ├── comment-formatter.ts
    │       ├── comment-formatter.test.ts
    │       ├── exit-codes.ts
    │       └── exit-codes.test.ts
    ├── shared/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vitest.config.ts
    │   └── src/
    │       ├── index.ts
    │       └── index.test.ts
    └── ui/
        ├── index.html
        ├── package.json
        ├── tsconfig.json
        ├── vite.config.ts
        └── src/main.tsx
```

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
| P24 | Git history + GitHub push | ⬜ Pending |

## What each completed prompt did
### P1 — Repo scaffold + CONTEXT.md
Initialized pnpm monorepo with 6 workspace packages. Installed all dependencies.
Configured TypeScript (strict), Vitest, Prettier, ESLint. Created Docker Compose
with PostgreSQL 16, Redis 7, and MinIO. Created .env.example and .gitignore.
Created placeholder source files and smoke test. 1 test passing.

Note: pnpm 11 requires `--ignore-scripts` for installs due to esbuild build script
security policy. Add `.npmrc` with `only-built-dependencies[]=esbuild` or use
`--ignore-scripts` flag. Vitest uses esbuild JS fallback — no functional impact.

### P6 — Risk engine v1
Six-dimension risk scorer in `@depgraph/risk`. Dimensions: security (critical/high/total
advisories + max CVSS), maintenance (days since commit/release, maintainer count, bus
factor), compatibility (semver violation rate, release cadence, version count),
concentration (bus factor + maintainer count), blast_radius (dependent count + transitive
depth), operational (commit frequency 30d, issue latency, PR merge latency). Weighted
composite: security 30%, maintenance 25%, blast_radius 20%, concentration 10%,
compatibility 10%, operational 5%. Explanations are flattened with adjusted
contribution_pct = factor_pct × dim_weight / 100. DB writer inserts risk_scores and
risk_explanations rows in a single transaction. `scorePackage` queries live signals,
advisories, consumer_edges, versions, and maintainers, then writes scores. `scorePackageBatch`
adds a concurrency semaphore (default 5). `risk-score` BullMQ queue added; osv-ingest
worker enqueues a score job after each successful package advisory write.

### P5 — OSV.dev advisory ingestion
OsvClient using undici — queryPackage, queryBatch (chunked at 1000), getVulnerability,
queryModifiedSince. Severity + CVSS parser mapping score ranges to critical/high/medium/
low/unknown. Affected version range parser handling SEMVER, ECOSYSTEM, and versions-array
formats. Redis-backed sync cursor per ecosystem. Advisory normalizer. BullMQ osv-ingest
worker with two modes: package (on-demand per package) and sync (incremental ecosystem-wide
via modified_since cursor). npm-process worker now enqueues osv-ingest after DB write. Sync
jobs seeded for all 3 ecosystems at startup.

### P4 — GitHub metadata + maintainer signals
GitHubClient using undici with rate-limit header respect, 202-retry for commit stats,
typed GitHubApiError. Signal calculator for 7 signal types (commit frequency 30d/90d,
days since commit, active maintainer count, bus factor, issue latency, PR merge latency).
Repository URL parser handling 7 input formats. IdentityLinker with 4-strategy
npm→GitHub username resolution. GitHub ingest BullMQ worker with parallel API fetches,
DB upserts, and signal insertion. npm-process worker now enqueues github-ingest after
successful DB write.

### P3 — npm registry crawler
Token-bucket rate limiter (in-memory, concurrent-safe). Exponential backoff retry
wrapper with jitter. NpmRegistryClient using undici with throttling and retry.
Data normalizer for packages/versions/deps/maintainers. Redis-backed deduplication.
MinIO raw JSON storage with auto-bucket-create. BullMQ queues (npm-crawl, npm-process).
Crawl worker (fetch → store → enqueue). Process worker (load → normalize → upsert DB
in transaction). Crawler entrypoint with 10-package seed list. Unit tests for rate
limiter, retry, and normalizer.

### P2 — Database schema
Defined all 17 Drizzle tables and 4 enums covering the full data model: packages,
versions, maintainers, maintainer_versions, repositories, package_repositories,
dependency_edges, consumer_edges, advisories, advisory_affected_versions, signals,
risk_scores, risk_explanations, snapshots, policy_rules, policy_violations,
upgrade_events. Added SIGNAL_NAMES const with 13 signal types. Database client
with pg Pool. Schema validation tests passing.

## Test count
- Total: 457
- Passing: 457
- Failing: 0

### P9 — Policy engine
Full condition DSL with 8 primitive condition types (composite_score, dimension_score,
maintainer_count, days_since_release, advisory_count, bus_factor, dependent_count,
ecosystem) plus and/or/not combinators. Pure condition evaluator with applyOperator helper.
Remediation generator producing human-readable fix guidance per condition type. 6 built-in
rules (single-maintainer-stale, high-blast-radius, critical-advisory-open, bus-factor-one,
high-composite-risk, abandoned-package). DB seeder that skips existing rules.
summarizeCondition for human-readable match descriptions. PolicyViolation DB writer.
Snapshot worker updated to evaluate rules and write violations after every full/ecosystem
snapshot. Built-in rules seeded on crawler startup.

### P8 — Snapshot system
SnapshotData + SnapshotDiff type definitions. Snapshot builder querying latest risk scores
per package with top 5 explanations and advisory counts. Snapshot persister writing full
JSONB blob to snapshots table with metadata. listSnapshots and getSnapshot query helpers.
Pure differ computing added/removed/improved/degraded/unchanged with changedDimensions and
new vulnerability chain detection. BullMQ snapshot worker with 4 modes: full (with
auto-diff), ecosystem, repository, diff. Daily cron scheduler using node:timers (no
external lib). Initial baseline snapshot seeded on startup.

### P16 — Forecasting UI
Client-side abandonment scorer: derives probability (0–1) from package detail signals
(days_since_last_commit 30%, commit_freq_trend 25% neutral, active_maintainer_count 25%,
bus_factor 20%). fetchAbandonmentScore + fetchPackageSignals + fetchSignalHistory added to
api.ts. useAbandonmentScore hook (5-min staleTime). AbandonmentGauge: SVG semicircular arc
gauge (180° sweep, path-based, large-arc math), probability%, recommendation badge, confidence
label, breakdown bars. RiskSparkline: pure SVG polyline (no recharts), dot for single point,
muted line for empty. ForecastWidget: linear slope from last 5 points, projected 30-day score,
recharts LineChart with real solid line + dashed projected line + delta summary text.
MaintainerTimeline: recharts AreaChart + 3 stat chips (active_maintainer_count / bus_factor /
days_since_last_commit) with alert coloring. PackageDetail 4th Forecast tab: gauge + timeline
grid + forecast widget. PackageList: Trend column with placeholder RiskSparkline (no N+1
requests). Vite build clean, 246/246 tests passing.

### P15 — Time-series signals + abandonment detector
Signal history query helpers (getSignalHistory, getLatestSignals, getSignalHistoryBatch) using
Drizzle sql template tag + DISTINCT ON for latest-per-name. Linear regression trend detector
(slope/r²/percentChange, 4 directions: increasing/decreasing/stable/insufficient_data). Weighted
abandonment probability scorer — 4 signals: days_since_last_commit (30%), commit_freq_trend (25%),
active_maintainer_count (25%), bus_factor (20%). Confidence levels (low/medium/high) based on
real data count. Bus-factor-to-1 alert classifier (new_single_maintainer / declining_to_one /
consistently_one). Signal backfill from snapshot history (advisory_count_open + dependent_count,
WHERE NOT EXISTS day-granularity dedup). Analysis BullMQ worker with 3 modes: package (score
one package), backfill (snapshot-history backfill), bus-factor-scan (all packages). runAnalysisQueue
added to queue/index.ts. github-ingest worker now enqueues analysis job after signals written.
crawler index seeds backfill + bus-factor-scan on startup. 22 new tests (9 trend-detector + 8
abandonment-scorer + 5 timeseries unit).

### P14 — Historical diff viewer + policy UI
Diff API types (SnapshotDiff, SnapshotDiffEntry, VulnerabilityChain) and fetch functions
(fetchSnapshotDiff via POST). Policy types (PolicyRule, PolicyViolation with snake_case
mapping) and fetch functions (rules, violations with filters + field mapping, dry-run
evaluate, resolve via PATCH). Hooks: useSnapshotDiff (dual null guard), usePolicyRules,
usePolicyViolations, useResolveViolation (useMutation + cache invalidation). Components:
ActionBadge (block/warn/approval colors), DiffSummaryBar (stat chips with colored borders),
DiffPackageRow (4 types — colored borders, delta display, changed dimension chips),
VulnChainAlert (warning card with relative time). Pages: SnapshotDiff (selector UI when
params missing, 4-tab diff view — degraded/improved/added-removed/vuln), PolicyViolations
(stats cards, table with inline resolve button, pagination, action/resolved filters),
PolicyRules (read-only rules table + info box). SnapshotList updated with Compare button.
Routes /snapshots/diff, /policy, /policy/rules added. Policy nav links added to sidebar.

### P13 — Graph explorer UI
Graph API fetch functions and types (subgraph, blast radius, chokepoints). useGraph hooks
(usePackageSubgraph, useBlastRadius, useChokepoints). riskColor/riskLabel utilities returning
hex values for Cytoscape canvas. Cytoscape stylesheet builder (node tint by risk score,
depth-colored edges, selected state accent). NodeDetailPanel (slide-in right panel, blast
radius stats, top consumers, navigate to detail). GraphControls (ecosystem filter, depth
selector, fit/reset, node/edge count). GraphExplorer page: chokepoints mode on load, package
search switching to subgraph mode, react-cytoscapejs cose layout, node tap → panel,
full-height layout. Route /graph added, nav link added to sidebar.

### P12 — React frontend v1
Dark design system with CSS custom properties (risk color coding, monospace accents, dark
scrollbar). Axios API client with 15s timeout, API key header, and typed response functions
for packages, history, advisories, snapshots, and health. TanStack Query setup (staleTime 30s,
no refetchOnWindowFocus) with 4 package hooks and 2 snapshot hooks. Shared components:
RiskBadge (score→color pill, 3 sizes), EcosystemBadge (colored left border), ScoreBar
(animated CSS transition on mount), LoadingSpinner (SVG spin), ErrorMessage (retry button),
Layout (220px sidebar NavLink nav + main + topbar). Pages: Dashboard (useEffect health status
pills, 4 metric cards, recent snapshots table, top risky packages table), PackageList
(ecosystem tabs, sort dropdown, 20-row skeleton loading, pagination), PackageDetail (3 tabs:
6 ScoreBars + explanations table, advisories table, recharts LineChart history), SnapshotList
(violation count color coding). React Router BrowserRouter. Vite build 675kB / gzip 206kB,
no TypeScript errors.

### P11 — REST API
Hono API server with CORS, logger, prettyJSON, and in-memory rate limiting (windowMs/maxRequests,
X-RateLimit-* headers). API key auth middleware with dev bypass when key absent. Response helpers:
ok(), err(), paginated(). Routes: GET /health (DB+Redis ping, always 200, no auth); packages (list
with lateral risk score join, detail with explanations/advisories/signals/blast-radius, versions,
history, advisories); snapshots (list, get, paginated snapshot packages, POST diff); policy (rules
list, violations with filters, dry-run evaluate, PATCH resolve); simulator (POST upgrade → simulateUpgrade,
GET history from upgrade_events where simulated=true); graph (subgraph BFS serialization, blast-radius,
chokepoints via computeCentrality). OpenAPI 3.1 spec at GET /openapi.json. Server on PORT 3001.
15 new tests (5 health + 5 auth + 5 rate-limit).

### P10 — Upgrade simulator
Semver utilities with no external lib: parseVersion (rejects ranges/special strings),
classifyUpgrade (patch/minor/major/unknown), assessBreakingRisk (none/low/medium/high based
on compatibility + composite score delta). computeTransitiveDiff queries dependency_edges for
both versions and returns sorted added/removed/version_changed entries. 12-step simulateUpgrade
pipeline: resolves package + versions, classifies upgrade, queries current risk scores, adjusts
scores for added/removed deps and semver compatibility, builds dimensionDiffs, computes
transitive diff, counts affected downstream packages, assesses breaking risk, generates
warnings, inserts upgrade_events row (simulated=true), returns SimulationResult. simulate-upgrade
BullMQ queue + worker added. simulateUpgradeQueue exported from queue/index.ts.
27 new tests (20 semver + 6 transitive-diff + 1 smoke).

### P7 — Transitive graph + blast radius
Pure in-memory graph traversal library: BFS descendants/ancestors, shortest path, cycle
detection, approximate betweenness centrality, chokepoint detection. DB resolver that
materializes adjacency maps from dependency_edges with ecosystem and subgraph filters.
Consumer edge populator that computes the full reverse graph (up to depth 5) and upserts
consumer_edges in batches. getBlastRadius() query for direct/transitive consumer counts and
top consumers. graph-populate BullMQ worker with full and incremental modes. Risk engine
updated to use fetchGraphRiskInputs(). npm-process worker now enqueues graph-populate after
DB write. drizzle-orm added as explicit dependency of @depgraph/crawler.

### P21 — CI gate GitHub Action
New workspace package @depgraph/action. action.yml manifest: 7 inputs (api-url, api-key, manifest-path, ecosystem, fail-on, post-comment, github-token), 4 outputs. Manifest parser: npm (package.json JSON parse), pypi (requirements.txt line parser), cargo (inline TOML section extractor). Action-specific API client (undici, no shared deps): evaluatePackages via GET /packages + GET /policy/violations per package, parallel with concurrency-5 semaphore. PR comment formatter producing GitHub Markdown with violation tables. Exit code resolver: 0/1/2 based on failOn threshold. Main entrypoint: reads inputs → parses manifest → evaluates → logs → sets outputs → posts PR comment → writes job summary → exits. Example workflows: depgraph.yml (scan on PR) and test.yml (run pnpm test on push). 30 new tests.

### P22 — Drift detection + alerting
Alert types: new_vulnerability, maintainer_collapse, score_spike, bus_factor_one. AlertRule with enabled/severity/delivery/throttleMinutes. AlertConfig with per-channel config (webhook + email). AlertDeduplicator: Redis-backed dedup using sorted key with configurable TTL. AlertStore: Redis sorted set (ZADD timestamp score, max 500, ZREVRANGE/ZRANGEBYSCORE). webhook-deliverer: undici POST, HMAC-SHA256 X-Depgraph-Signature header, bodyTimeout+headersTimeout. email-deliverer: nodemailer SMTP, HTML+text body, never throws. AlertDispatcher: filters duplicates, routes to webhook/email/log_only, marks sent, returns DispatchResult. detectDrift: finds 7-day baseline via listSnapshots, runs diffSnapshots, generates 4 alert types (new_vulnerability from newVulnerabilityChains, score_spike when delta ≥ scoreSpikeThreshold, maintainer_collapse when maintenance drops >20pts in changedDimensions, bus_factor_one via DB query for bus_factor=1 signal). snapshot.worker updated to run detectDrift + dispatch alerts after full snapshot. crawler index.ts builds AlertConfig from 8 env vars. .env.example updated with ALERT_WEBHOOK_URL/SECRET/TIMEOUT_MS + SMTP vars. Alerts API route: GET /alerts (limit/type/since filters), GET /alerts/count, DELETE /alerts. alertsRouter registered in app.ts. DepgraphAlert type + fetchAlerts + fetchAlertCount added to ui api.ts. useAlerts hook (staleTime+refetchInterval 30s). AlertFeed component: severity-colored left border, relative time, truncated message, empty state. Dashboard updated with 5th "Recent Alerts" section. 19 new tests (deduplicator ×5, dispatcher ×6, drift-detector ×7, drift key format ×1).

### P20 — Portfolio risk dashboard
Five portfolio API routes: summary (aggregate stats across all ecosystems), top-risky (N riskiest packages org-wide), chokepoints (cross-ecosystem structural risks), ecosystem-breakdown (per-ecosystem stats with top risky package), trend (last N snapshots as time series). Portfolio routes registered in app.ts + OpenAPI. UI: PortfolioSummary/EcosystemBreakdown/PortfolioTrendPoint types + 5 fetch fns. usePortfolio hooks (5). Components: ScoreDistributionChart (recharts donut, 5 segments), EcosystemCard (2×2 stats grid, colored left border), PortfolioTrendChart (ComposedChart: Area + Line + Bar, dual Y axes), ChokepointTable (rank + gold border top 3). Portfolio page: 6 summary cards, distribution + ecosystem row, full-width trend chart, top-risky + chokepoints split. Ecosystem filter tabs. /portfolio route + Portfolio nav link added.

### P19 — Cross-ecosystem normalization
EcosystemAdapter interface: CanonicalPackage, CanonicalVersion, CanonicalDependency,
NormalizedRange, ParsedEcosystemVersion. Version normalizer: npm/cargo strip v + semver passthrough,
pypi PEP 440 → semver-like (epoch * 10000 + major, pre-release type mapping a→alpha/b→beta/rc/dev).
isPreReleaseVersion, compareVersions per ecosystem. Range normalizer: ^/~/exact/wildcard/comparison
operators for all 3 ecosystems; PyPI ~= (compatible release) and == handling; NormalizedRange with
lower/upper bounds. Package identity resolver: same_repository_url (0.6), exact_name_match (0.3),
similar_name after prefix stripping (0.1). getPackageIdentityMap. Cross-ecosystem chokepoint detector
(consumer_edges query). NpmAdapter, PypiAdapter, CargoAdapter implementing EcosystemAdapter. Adapter
registry (getAdapter). Snapshot worker updated to run identity resolution on full snapshots. 45 new
tests (version-normalizer × 27 + compareVersions × 6, range-normalizer × 17). Total: 371.

### P18 — Cargo crawler
CratesIoClient using undici with User-Agent header (crates.io requirement), 1 req/s rate limit
(stricter than npm/PyPI), getCrate/getCrateDependencies/searchCrates. Cargo version requirement
parser: ^/~/=/>/</>=/<= operators, multi-constraint comma parsing, bare version defaults to ^,
cargoReqToString. Minimal TOML parser (no library): sections, key-value, inline tables, arrays,
[[array-of-tables]], comment stripping, dotted section keys. Cargo data normalizer: yanked version
exclusion, build dep kind filtering, published_by maintainer deduplication by login,
repository_url strips .git suffix. cargo-crawl worker (fetches deps for latest 5 non-yanked
versions to avoid rate limit storm). cargo-process worker (reconstructs Map from stored JSON).
Two new queues (cargo-crawl, cargo-process). Separate 1 req/s cargoLimiter. 10 seed crates
queued on startup. 34 new tests (version-req × 13, toml-parser × 11, normalizer × 9). Total: 326.

### P17 — PyPI crawler
PypiRegistryClient using undici, PEP 503 name normalization (normalizePypiName). PEP 440 version
parser: epoch, release, pre/post/dev/local parsing, isStableRelease, comparePep440. PEP 508
dependency specifier parser: extras, version spec, environment markers, isDev/isOptional detection.
PyPI data normalizer: repository_url from project_urls, has_types from classifiers, maintainers
from author/maintainer fields, dep parsing from requires_dist. pypi-crawl and pypi-process BullMQ
workers (same pattern as npm). Two new queues added (pypi-crawl, pypi-process). 10 PyPI seed
packages queued on startup. 46 new tests (pep440 × 28, pep508 × 10, normalizer × 8). Total: 292.

### P23 — Benchmark suite + local dev mode
Fixture data: 10 pre-crawled package JSON files (3 npm, 3 pypi, 4 cargo including deps files) for offline operation. Fixture loader: loadFixture, listFixtures, loadAllFixtures (ESM-safe path resolution via import.meta.url). Offline seed: seedFromFixtures writes fixture data to DB via real normalizers (npm/pypi/cargo), clearFixtureData removes fixture packages. SQLite mode: isSqliteMode() detection (DATABASE_URL starts with sqlite: or FILE_DB env var), createSqliteDb() using better-sqlite3 + drizzle-orm/better-sqlite3. Crawler throughput benchmark: measures packages/sec, cache hit rate, API error rate — works with fixtures or real network. Risk scoring benchmark: measures scoring throughput, consistency across runs (max variance), explanation coverage. Benchmark runner CLI (runner.ts) with in-memory dedup for offline use, formatted ASCII table output, `--fixtures` / `--ecosystem` / `--scoring` / `--help` flags. `pnpm benchmark` root script. `--seed-fixtures` flag in crawler entrypoint (calls seedFromFixtures + exit). SQLite env example in .env.example. better-sqlite3 added as dependency with allowBuilds in pnpm-workspace.yaml. 26 new tests (loader × 15 + crawler-benchmark × 6 + scoring-benchmark × 5). Total: 457.

## Known issues and technical debt
- pnpm 11 security policy blocks esbuild native binary compilation. Use `--ignore-scripts`
  for pnpm installs or configure `onlyBuiltDependencies` via pnpm settings file
  (pnpm 11 no longer reads `"pnpm"` field in package.json).

## Deviations from spec
- Added `.npmrc` for pnpm 11 compatibility
- Added `pnpm-workspace.yaml` (required by pnpm — `"workspaces"` in package.json not supported)
- `@depgraph/crawler` now explicitly depends on `drizzle-orm` and `@depgraph/db` (required
  for graph/ modules that use drizzle sql helpers and DB types)
