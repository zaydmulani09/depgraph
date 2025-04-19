import { describe, it, expect } from 'vitest'
import { resolveExitCode, EXIT_SUCCESS, EXIT_WARN, EXIT_BLOCK } from './exit-codes'
import type { ViolationResult } from './api-client'

function v(action: ViolationResult['action']): ViolationResult {
  return { packageName: 'pkg', action, ruleName: 'rule', remediation: 'fix it', compositeScore: 80 }
}

describe('resolveExitCode', () => {
  it('no violations → EXIT_SUCCESS for failOn: block', () => {
    expect(resolveExitCode([], 'block')).toBe(EXIT_SUCCESS)
  })

  it('no violations → EXIT_SUCCESS for failOn: warn', () => {
    expect(resolveExitCode([], 'warn')).toBe(EXIT_SUCCESS)
  })

  it('no violations → EXIT_SUCCESS for failOn: require_approval', () => {
    expect(resolveExitCode([], 'require_approval')).toBe(EXIT_SUCCESS)
  })

  it('block violation + failOn: block → EXIT_BLOCK', () => {
    expect(resolveExitCode([v('block')], 'block')).toBe(EXIT_BLOCK)
  })

  it('block violation + failOn: warn → EXIT_BLOCK', () => {
    expect(resolveExitCode([v('block')], 'warn')).toBe(EXIT_BLOCK)
  })

  it('warn violation only + failOn: block → EXIT_SUCCESS', () => {
    expect(resolveExitCode([v('warn')], 'block')).toBe(EXIT_SUCCESS)
  })

  it('warn violation only + failOn: warn → EXIT_WARN', () => {
    expect(resolveExitCode([v('warn')], 'warn')).toBe(EXIT_WARN)
  })

  it('require_approval violation + failOn: require_approval → EXIT_WARN', () => {
    expect(resolveExitCode([v('require_approval')], 'require_approval')).toBe(EXIT_WARN)
  })

  it('require_approval violation + failOn: block → EXIT_SUCCESS', () => {
    expect(resolveExitCode([v('require_approval')], 'block')).toBe(EXIT_SUCCESS)
  })

  it('warn + block → EXIT_BLOCK regardless of failOn', () => {
    expect(resolveExitCode([v('warn'), v('block')], 'warn')).toBe(EXIT_BLOCK)
  })
})
