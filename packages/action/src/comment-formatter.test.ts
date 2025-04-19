import { describe, it, expect } from 'vitest'
import { formatPRComment } from './comment-formatter'
import type { ActionSummary } from './comment-formatter'
import type { ViolationResult } from './api-client'

const baseSummary: ActionSummary = {
  ecosystem: 'npm',
  manifestPath: 'package.json',
  totalPackagesScanned: 10,
  blockCount: 0,
  warnCount: 0,
  approvalCount: 0,
  passCount: 10,
  runUrl: 'https://github.com/test/repo/actions/runs/123',
}

function vio(action: ViolationResult['action']): ViolationResult {
  return {
    packageName: 'lodash',
    action,
    ruleName: 'high-composite-risk',
    remediation: 'upgrade to safer version',
    compositeScore: 85,
  }
}

describe('formatPRComment', () => {
  it('with 0 violations contains "No policy violations found"', () => {
    const result = formatPRComment([], baseSummary)
    expect(result).toContain('No policy violations found')
  })

  it('with block violations contains "Blocking violations" section', () => {
    const violations = [vio('block')]
    const result = formatPRComment(violations, { ...baseSummary, blockCount: 1, passCount: 9 })
    expect(result).toContain('Blocking violations')
  })

  it('with warn violations contains "Warnings" section', () => {
    const violations = [vio('warn')]
    const result = formatPRComment(violations, { ...baseSummary, warnCount: 1, passCount: 9 })
    expect(result).toContain('Warnings')
  })

  it('package name appears in monospace backtick format', () => {
    const violations = [vio('block')]
    const result = formatPRComment(violations, { ...baseSummary, blockCount: 1, passCount: 9 })
    expect(result).toContain('`lodash`')
  })

  it('contains the manifest path in footer', () => {
    const result = formatPRComment([], baseSummary)
    expect(result).toContain('package.json')
  })

  it('contains metrics table with scanned count', () => {
    const result = formatPRComment([], baseSummary)
    expect(result).toContain('Packages scanned')
    expect(result).toContain('10')
  })

  it('no "Blocking violations" heading when violations array is empty', () => {
    const result = formatPRComment([], baseSummary)
    expect(result).not.toContain('Blocking violations')
  })

  it('contains ecosystem in footer', () => {
    const result = formatPRComment([], baseSummary)
    expect(result).toContain('npm')
  })
})
