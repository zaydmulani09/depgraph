import type { ViolationResult } from './api-client'

export const EXIT_SUCCESS = 0
export const EXIT_WARN = 1
export const EXIT_BLOCK = 2

export function resolveExitCode(
  violations: ViolationResult[],
  failOn: 'block' | 'warn' | 'require_approval'
): number {
  const hasBlock = violations.some((v) => v.action === 'block')
  const hasWarn = violations.some((v) => v.action === 'warn')
  const hasApproval = violations.some((v) => v.action === 'require_approval')

  if (hasBlock) return EXIT_BLOCK

  if (failOn === 'warn' && hasWarn) return EXIT_WARN
  if (failOn === 'require_approval' && (hasWarn || hasApproval)) return EXIT_WARN

  return EXIT_SUCCESS
}
