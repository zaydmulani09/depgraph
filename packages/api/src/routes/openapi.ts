import { Hono } from 'hono'

const router = new Hono()

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'depgraph API',
    version: '0.1.0',
    description: 'REST API for dependency intelligence — risk scores, snapshots, policy, and upgrade simulation.',
  },
  security: [{ ApiKeyAuth: [] }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        security: [],
        responses: {
          200: {
            description: 'Service health',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    version: { type: 'string', example: '0.1.0' },
                    timestamp: { type: 'string', format: 'date-time' },
                    services: {
                      type: 'object',
                      properties: {
                        database: { type: 'string', enum: ['ok', 'error'] },
                        redis: { type: 'string', enum: ['ok', 'error'] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/packages': {
      get: {
        summary: 'List packages with risk scores',
        parameters: [
          { name: 'ecosystem', in: 'query', schema: { type: 'string', enum: ['npm', 'pypi', 'cargo'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'sort', in: 'query', schema: { type: 'string', default: 'composite_score_desc' } },
        ],
        responses: { 200: { description: 'Paginated package list' } },
      },
    },
    '/packages/{ecosystem}/{name}': {
      get: {
        summary: 'Package detail with scores, advisories, signals',
        parameters: [
          { name: 'ecosystem', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Package detail' },
          404: { description: 'Package not found' },
        },
      },
    },
    '/packages/{ecosystem}/{name}/versions': {
      get: {
        summary: 'Package versions',
        parameters: [
          { name: 'ecosystem', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Version list' } },
      },
    },
    '/packages/{ecosystem}/{name}/history': {
      get: {
        summary: 'Risk score history for trend charts',
        parameters: [
          { name: 'ecosystem', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
        ],
        responses: { 200: { description: 'Score history' } },
      },
    },
    '/packages/{ecosystem}/{name}/advisories': {
      get: {
        summary: 'All advisories for a package',
        parameters: [
          { name: 'ecosystem', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Advisory list' } },
      },
    },
    '/snapshots': {
      get: {
        summary: 'List snapshots',
        parameters: [
          { name: 'repositoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, maximum: 50 } },
        ],
        responses: { 200: { description: 'Snapshot metadata list' } },
      },
    },
    '/snapshots/{id}': {
      get: {
        summary: 'Get full snapshot data',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Snapshot data' },
          404: { description: 'Not found' },
        },
      },
    },
    '/snapshots/{id}/packages': {
      get: {
        summary: 'Paginated packages from inside snapshot',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'sort', in: 'query', schema: { type: 'string' } },
          { name: 'ecosystem', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated snapshot packages' } },
      },
    },
    '/snapshots/diff': {
      post: {
        summary: 'Diff two snapshots',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['previousSnapshotId', 'currentSnapshotId'],
                properties: {
                  previousSnapshotId: { type: 'string', format: 'uuid' },
                  currentSnapshotId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Snapshot diff' },
          404: { description: 'Snapshot not found' },
        },
      },
    },
    '/policy/rules': {
      get: {
        summary: 'List all policy rules',
        responses: { 200: { description: 'Policy rules' } },
      },
    },
    '/policy/violations': {
      get: {
        summary: 'List policy violations',
        parameters: [
          { name: 'packageId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'action', in: 'query', schema: { type: 'string', enum: ['block', 'warn', 'require_approval'] } },
          { name: 'resolved', in: 'query', schema: { type: 'boolean', default: false } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated violations' } },
      },
    },
    '/policy/evaluate': {
      post: {
        summary: 'Dry-run policy evaluation against a snapshot',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['snapshotId'],
                properties: { snapshotId: { type: 'string', format: 'uuid' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Violations from dry-run' } },
      },
    },
    '/policy/violations/{id}/resolve': {
      patch: {
        summary: 'Mark a violation as resolved',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Resolved violation' },
          404: { description: 'Violation not found' },
        },
      },
    },
    '/simulate/upgrade': {
      post: {
        summary: 'Simulate a package upgrade',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['packageName', 'ecosystem', 'fromVersion', 'toVersion'],
                properties: {
                  packageName: { type: 'string' },
                  ecosystem: { type: 'string', enum: ['npm', 'pypi', 'cargo'] },
                  fromVersion: { type: 'string' },
                  toVersion: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Simulation result' },
          404: { description: 'Package not found' },
        },
      },
    },
    '/simulate/upgrade/history': {
      get: {
        summary: 'Simulated upgrade history',
        parameters: [
          { name: 'packageId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Upgrade event history' } },
      },
    },
    '/graph/package/{packageId}/subgraph': {
      get: {
        summary: 'Get dependency subgraph for a package',
        parameters: [
          { name: 'packageId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'depth', in: 'query', schema: { type: 'integer', default: 3, maximum: 5 } },
        ],
        responses: { 200: { description: 'Nodes and edges' } },
      },
    },
    '/graph/package/{packageId}/blast-radius': {
      get: {
        summary: 'Blast radius for a package',
        parameters: [
          { name: 'packageId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Blast radius summary' } },
      },
    },
    '/graph/chokepoints': {
      get: {
        summary: 'Top chokepoints by centrality score',
        parameters: [
          { name: 'ecosystem', in: 'query', schema: { type: 'string', enum: ['npm', 'pypi', 'cargo'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Chokepoint list' } },
      },
    },
    '/portfolio/summary': {
      get: {
        summary: 'Portfolio aggregate stats across all ecosystems',
        responses: {
          200: {
            description: 'Portfolio summary',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    totalPackages: { type: 'integer' },
                    totalVersions: { type: 'integer' },
                    totalAdvisories: { type: 'integer' },
                    avgCompositeScore: { type: 'number' },
                    maxCompositeScore: { type: 'number' },
                    packagesByEcosystem: { type: 'object', additionalProperties: { type: 'integer' } },
                    scoreDistribution: {
                      type: 'object',
                      properties: {
                        critical: { type: 'integer' },
                        high: { type: 'integer' },
                        medium: { type: 'integer' },
                        low: { type: 'integer' },
                        unscored: { type: 'integer' },
                      },
                    },
                    activeViolations: { type: 'integer' },
                    blockViolations: { type: 'integer' },
                    lastSnapshotAt: { type: 'string', nullable: true },
                    lastSnapshotId: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/portfolio/top-risky': {
      get: {
        summary: 'Top N riskiest packages org-wide',
        parameters: [
          { name: 'ecosystem', in: 'query', schema: { type: 'string', enum: ['npm', 'pypi', 'cargo'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, maximum: 50 } },
        ],
        responses: { 200: { description: 'Top risky packages array' } },
      },
    },
    '/portfolio/chokepoints': {
      get: {
        summary: 'Cross-ecosystem structural chokepoints',
        parameters: [
          { name: 'ecosystem', in: 'query', schema: { type: 'string', enum: ['npm', 'pypi', 'cargo'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: { 200: { description: 'Chokepoint list' } },
      },
    },
    '/portfolio/ecosystem-breakdown': {
      get: {
        summary: 'Per-ecosystem stats with top risky package',
        responses: {
          200: {
            description: 'Ecosystem breakdown array',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      ecosystem: { type: 'string' },
                      packageCount: { type: 'integer' },
                      avgCompositeScore: { type: 'number' },
                      maxCompositeScore: { type: 'number' },
                      criticalCount: { type: 'integer' },
                      advisoryCount: { type: 'integer' },
                      topRiskyPackage: {
                        nullable: true,
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          score: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/portfolio/trend': {
      get: {
        summary: 'Last N snapshots as portfolio risk time series',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
        ],
        responses: {
          200: {
            description: 'Trend time series',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      snapshotId: { type: 'string' },
                      label: { type: 'string', nullable: true },
                      snapshottedAt: { type: 'string', format: 'date-time' },
                      avgCompositeScore: { type: 'number', nullable: true },
                      maxCompositeScore: { type: 'number', nullable: true },
                      packageCount: { type: 'integer' },
                      violationCount: { type: 'integer', nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/openapi.json': {
      get: {
        summary: 'OpenAPI spec',
        security: [],
        responses: { 200: { description: 'OpenAPI 3.1 spec' } },
      },
    },
  },
}

router.get('/', (c) => c.json(spec))

export { router as openApiRouter }
