import {
  pgEnum,
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  real,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const ecosystemEnum = pgEnum('ecosystem', ['npm', 'pypi', 'cargo'])
export const severityEnum = pgEnum('severity', ['critical', 'high', 'medium', 'low', 'unknown'])
export const actionEnum = pgEnum('policy_action', ['block', 'warn', 'require_approval'])
export const alertTypeEnum = pgEnum('alert_type', [
  'new_vulnerability',
  'maintainer_collapse',
  'score_spike',
  'bus_factor_one',
])

// ─── Signal names ─────────────────────────────────────────────────────────────

export const SIGNAL_NAMES = [
  'commit_frequency_30d',
  'commit_frequency_90d',
  'issue_response_latency_days',
  'pr_merge_latency_days',
  'active_maintainer_count',
  'bus_factor',
  'release_cadence_days',
  'semver_violation_rate',
  'download_count_weekly',
  'dependent_count',
  'advisory_count_open',
  'days_since_last_release',
  'days_since_last_commit',
] as const

export type SignalName = (typeof SIGNAL_NAMES)[number]

// ─── Table 1 — packages ───────────────────────────────────────────────────────

export const packages = pgTable(
  'packages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ecosystem: ecosystemEnum('ecosystem').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    homepage: text('homepage'),
    repository_url: text('repository_url'),
    latest_version: text('latest_version'),
    first_published_at: timestamp('first_published_at'),
    last_published_at: timestamp('last_published_at'),
    weekly_downloads: integer('weekly_downloads'),
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
  },
  (t) => [uniqueIndex('packages_ecosystem_name_idx').on(t.ecosystem, t.name)]
)

// ─── Table 2 — versions ───────────────────────────────────────────────────────

export const versions = pgTable(
  'versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    package_id: uuid('package_id')
      .references(() => packages.id, { onDelete: 'cascade' })
      .notNull(),
    version: text('version').notNull(),
    published_at: timestamp('published_at'),
    tarball_url: text('tarball_url'),
    license: text('license'),
    has_types: boolean('has_types').default(false),
    deprecated: boolean('deprecated').default(false),
    deprecation_message: text('deprecation_message'),
    created_at: timestamp('created_at').defaultNow(),
  },
  (t) => [uniqueIndex('versions_package_id_version_idx').on(t.package_id, t.version)]
)

// ─── Table 3 — maintainers ────────────────────────────────────────────────────

export const maintainers = pgTable(
  'maintainers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ecosystem: ecosystemEnum('ecosystem').notNull(),
    registry_username: text('registry_username').notNull(),
    github_login: text('github_login'),
    github_id: integer('github_id'),
    email: text('email'),
    avatar_url: text('avatar_url'),
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
  },
  (t) => [uniqueIndex('maintainers_ecosystem_username_idx').on(t.ecosystem, t.registry_username)]
)

// ─── Table 4 — maintainer_versions ───────────────────────────────────────────

export const maintainerVersions = pgTable(
  'maintainer_versions',
  {
    maintainer_id: uuid('maintainer_id')
      .references(() => maintainers.id, { onDelete: 'cascade' })
      .notNull(),
    version_id: uuid('version_id')
      .references(() => versions.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.maintainer_id, t.version_id] })]
)

// ─── Table 5 — repositories ───────────────────────────────────────────────────

export const repositories = pgTable(
  'repositories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    owner: text('owner').notNull(),
    repo: text('repo').notNull(),
    default_branch: text('default_branch').default('main'),
    stars: integer('stars').default(0),
    forks: integer('forks').default(0),
    open_issues: integer('open_issues').default(0),
    is_archived: boolean('is_archived').default(false),
    last_commit_at: timestamp('last_commit_at'),
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
  },
  (t) => [uniqueIndex('repositories_owner_repo_idx').on(t.owner, t.repo)]
)

// ─── Table 6 — package_repositories ──────────────────────────────────────────

export const packageRepositories = pgTable(
  'package_repositories',
  {
    package_id: uuid('package_id')
      .references(() => packages.id, { onDelete: 'cascade' })
      .notNull(),
    repository_id: uuid('repository_id')
      .references(() => repositories.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.package_id, t.repository_id] })]
)

// ─── Table 7 — dependency_edges ───────────────────────────────────────────────

export const dependencyEdges = pgTable(
  'dependency_edges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    from_version_id: uuid('from_version_id')
      .references(() => versions.id, { onDelete: 'cascade' })
      .notNull(),
    to_package_id: uuid('to_package_id')
      .references(() => packages.id, { onDelete: 'cascade' })
      .notNull(),
    version_range: text('version_range').notNull(),
    is_dev: boolean('is_dev').default(false),
    is_optional: boolean('is_optional').default(false),
    is_peer: boolean('is_peer').default(false),
    created_at: timestamp('created_at').defaultNow(),
  },
  (t) => [
    index('dependency_edges_from_version_idx').on(t.from_version_id),
    index('dependency_edges_to_package_idx').on(t.to_package_id),
  ]
)

// ─── Table 8 — consumer_edges ─────────────────────────────────────────────────

export const consumerEdges = pgTable(
  'consumer_edges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    package_id: uuid('package_id')
      .references(() => packages.id, { onDelete: 'cascade' })
      .notNull(),
    consumer_version_id: uuid('consumer_version_id')
      .references(() => versions.id, { onDelete: 'cascade' })
      .notNull(),
    depth: integer('depth').notNull(),
    created_at: timestamp('created_at').defaultNow(),
  },
  (t) => [
    uniqueIndex('consumer_edges_package_consumer_idx').on(t.package_id, t.consumer_version_id),
    index('consumer_edges_package_idx').on(t.package_id),
  ]
)

// ─── Table 9 — advisories ─────────────────────────────────────────────────────

export const advisories = pgTable(
  'advisories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    osv_id: text('osv_id').unique().notNull(),
    package_id: uuid('package_id')
      .references(() => packages.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description'),
    severity: severityEnum('severity').default('unknown'),
    cvss_score: real('cvss_score'),
    published_at: timestamp('published_at'),
    modified_at: timestamp('modified_at'),
    withdrawn_at: timestamp('withdrawn_at'),
    aliases: text('aliases').array().default([]),
    created_at: timestamp('created_at').defaultNow(),
  },
  (t) => [
    index('advisories_package_id_idx').on(t.package_id),
    index('advisories_osv_id_idx').on(t.osv_id),
  ]
)

// ─── Table 10 — advisory_affected_versions ────────────────────────────────────

export const advisoryAffectedVersions = pgTable(
  'advisory_affected_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    advisory_id: uuid('advisory_id')
      .references(() => advisories.id, { onDelete: 'cascade' })
      .notNull(),
    version_range: text('version_range').notNull(),
    fixed_version: text('fixed_version'),
    created_at: timestamp('created_at').defaultNow(),
  },
  (t) => [index('advisory_affected_versions_advisory_idx').on(t.advisory_id)]
)

// ─── Table 11 — signals ───────────────────────────────────────────────────────

export const signals = pgTable(
  'signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    package_id: uuid('package_id')
      .references(() => packages.id, { onDelete: 'cascade' })
      .notNull(),
    signal_name: text('signal_name').notNull(),
    value: real('value').notNull(),
    measured_at: timestamp('measured_at').notNull(),
    created_at: timestamp('created_at').defaultNow(),
  },
  (t) => [index('signals_package_signal_measured_idx').on(t.package_id, t.signal_name, t.measured_at)]
)

// ─── Table 12 — risk_scores ───────────────────────────────────────────────────

export const riskScores = pgTable(
  'risk_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    package_id: uuid('package_id')
      .references(() => packages.id, { onDelete: 'cascade' })
      .notNull(),
    security_score: real('security_score').notNull(),
    maintenance_score: real('maintenance_score').notNull(),
    compatibility_score: real('compatibility_score').notNull(),
    concentration_score: real('concentration_score').notNull(),
    blast_radius_score: real('blast_radius_score').notNull(),
    operational_score: real('operational_score').notNull(),
    composite_score: real('composite_score').notNull(),
    scored_at: timestamp('scored_at').defaultNow(),
  },
  (t) => [
    index('risk_scores_package_id_idx').on(t.package_id),
    index('risk_scores_scored_at_idx').on(t.scored_at),
  ]
)

// ─── Table 13 — risk_explanations ────────────────────────────────────────────

export const riskExplanations = pgTable(
  'risk_explanations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    risk_score_id: uuid('risk_score_id')
      .references(() => riskScores.id, { onDelete: 'cascade' })
      .notNull(),
    factor_name: text('factor_name').notNull(),
    dimension: text('dimension').notNull(),
    contribution_pct: real('contribution_pct').notNull(),
    raw_value: real('raw_value'),
    description: text('description').notNull(),
    created_at: timestamp('created_at').defaultNow(),
  },
  (t) => [index('risk_explanations_risk_score_idx').on(t.risk_score_id)]
)

// ─── Table 14 — snapshots ─────────────────────────────────────────────────────

export const snapshots = pgTable(
  'snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repository_id: uuid('repository_id').references(() => repositories.id, { onDelete: 'set null' }),
    label: text('label'),
    package_count: integer('package_count').notNull().default(0),
    avg_composite_score: real('avg_composite_score'),
    max_composite_score: real('max_composite_score'),
    violation_count: integer('violation_count').default(0),
    snapshot_data: jsonb('snapshot_data').notNull(),
    snapshotted_at: timestamp('snapshotted_at').defaultNow(),
  },
  (t) => [
    index('snapshots_repository_id_idx').on(t.repository_id),
    index('snapshots_snapshotted_at_idx').on(t.snapshotted_at),
  ]
)

// ─── Table 15 — policy_rules ──────────────────────────────────────────────────

export const policyRules = pgTable('policy_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  action: actionEnum('action').notNull(),
  condition_json: jsonb('condition_json').notNull(),
  is_enabled: boolean('is_enabled').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
})

// ─── Table 16 — policy_violations ────────────────────────────────────────────

export const policyViolations = pgTable(
  'policy_violations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rule_id: uuid('rule_id')
      .references(() => policyRules.id, { onDelete: 'cascade' })
      .notNull(),
    package_id: uuid('package_id')
      .references(() => packages.id, { onDelete: 'cascade' })
      .notNull(),
    snapshot_id: uuid('snapshot_id').references(() => snapshots.id, { onDelete: 'cascade' }),
    action: actionEnum('action').notNull(),
    remediation: text('remediation'),
    resolved_at: timestamp('resolved_at'),
    created_at: timestamp('created_at').defaultNow(),
  },
  (t) => [
    index('policy_violations_package_id_idx').on(t.package_id),
    index('policy_violations_rule_id_idx').on(t.rule_id),
  ]
)

// ─── Table 17 — upgrade_events ────────────────────────────────────────────────

export const upgradeEvents = pgTable(
  'upgrade_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    package_id: uuid('package_id')
      .references(() => packages.id, { onDelete: 'cascade' })
      .notNull(),
    from_version: text('from_version').notNull(),
    to_version: text('to_version').notNull(),
    is_breaking: boolean('is_breaking').default(false),
    score_delta: real('score_delta'),
    simulated: boolean('simulated').default(false),
    evaluated_at: timestamp('evaluated_at').defaultNow(),
  },
  (t) => [index('upgrade_events_package_id_idx').on(t.package_id)]
)
