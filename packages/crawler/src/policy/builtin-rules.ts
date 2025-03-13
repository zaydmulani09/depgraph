import type { PolicyRule } from './types'

export const BUILTIN_RULES: Omit<PolicyRule, 'id'>[] = [
  {
    name: 'single-maintainer-stale',
    description: 'Block packages with only one maintainer and no release in 180 days',
    action: 'block',
    condition: {
      type: 'and',
      conditions: [
        { type: 'maintainer_count', operator: 'lte', value: 1 },
        { type: 'days_since_release', operator: 'gte', value: 180 },
      ],
    },
    is_enabled: true,
  },
  {
    name: 'high-blast-radius',
    description: 'Warn on packages with more than 500 downstream dependents',
    action: 'warn',
    condition: { type: 'dependent_count', operator: 'gt', value: 500 },
    is_enabled: true,
  },
  {
    name: 'critical-advisory-open',
    description: 'Block packages with any open critical advisories',
    action: 'block',
    condition: { type: 'dimension_score', dimension: 'security', operator: 'gte', value: 60 },
    is_enabled: true,
  },
  {
    name: 'bus-factor-one',
    description: 'Require approval for packages where a single contributor owns all commits',
    action: 'require_approval',
    condition: { type: 'bus_factor', operator: 'lte', value: 1 },
    is_enabled: true,
  },
  {
    name: 'high-composite-risk',
    description: 'Warn on any package with composite risk score above 70',
    action: 'warn',
    condition: { type: 'composite_score', operator: 'gt', value: 70 },
    is_enabled: true,
  },
  {
    name: 'abandoned-package',
    description: 'Block packages with no commits in 365 days and composite score above 50',
    action: 'block',
    condition: {
      type: 'and',
      conditions: [
        { type: 'days_since_release', operator: 'gte', value: 365 },
        { type: 'composite_score', operator: 'gt', value: 50 },
      ],
    },
    is_enabled: true,
  },
]
