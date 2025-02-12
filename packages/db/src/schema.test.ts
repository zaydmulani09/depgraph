import { describe, it, expect } from 'vitest'
import {
  ecosystemEnum,
  severityEnum,
  actionEnum,
  alertTypeEnum,
  SIGNAL_NAMES,
  packages,
  versions,
  maintainers,
  maintainerVersions,
  repositories,
  packageRepositories,
  dependencyEdges,
  consumerEdges,
  advisories,
  advisoryAffectedVersions,
  signals,
  riskScores,
  riskExplanations,
  snapshots,
  policyRules,
  policyViolations,
  upgradeEvents,
} from './schema'

describe('schema — enums', () => {
  it('ecosystemEnum has npm, pypi, cargo', () => {
    expect(ecosystemEnum.enumValues).toContain('npm')
    expect(ecosystemEnum.enumValues).toContain('pypi')
    expect(ecosystemEnum.enumValues).toContain('cargo')
  })

  it('severityEnum has all 5 levels', () => {
    expect(severityEnum.enumValues).toContain('critical')
    expect(severityEnum.enumValues).toContain('high')
    expect(severityEnum.enumValues).toContain('medium')
    expect(severityEnum.enumValues).toContain('low')
    expect(severityEnum.enumValues).toContain('unknown')
  })

  it('actionEnum exists', () => {
    expect(actionEnum).toBeDefined()
    expect(actionEnum.enumValues).toContain('block')
    expect(actionEnum.enumValues).toContain('warn')
    expect(actionEnum.enumValues).toContain('require_approval')
  })

  it('alertTypeEnum exists', () => {
    expect(alertTypeEnum).toBeDefined()
  })
})

describe('schema — SIGNAL_NAMES', () => {
  it('has exactly 13 entries', () => {
    expect(SIGNAL_NAMES).toHaveLength(13)
  })

  it('contains expected signal names', () => {
    expect(SIGNAL_NAMES).toContain('bus_factor')
    expect(SIGNAL_NAMES).toContain('commit_frequency_30d')
    expect(SIGNAL_NAMES).toContain('days_since_last_commit')
  })
})

describe('schema — tables exist', () => {
  const tables = [
    ['packages', packages],
    ['versions', versions],
    ['maintainers', maintainers],
    ['maintainerVersions', maintainerVersions],
    ['repositories', repositories],
    ['packageRepositories', packageRepositories],
    ['dependencyEdges', dependencyEdges],
    ['consumerEdges', consumerEdges],
    ['advisories', advisories],
    ['advisoryAffectedVersions', advisoryAffectedVersions],
    ['signals', signals],
    ['riskScores', riskScores],
    ['riskExplanations', riskExplanations],
    ['snapshots', snapshots],
    ['policyRules', policyRules],
    ['policyViolations', policyViolations],
    ['upgradeEvents', upgradeEvents],
  ] as const

  for (const [name, table] of tables) {
    it(`${name} is defined`, () => {
      expect(table).toBeDefined()
      expect(table).not.toBeNull()
    })
  }
})
