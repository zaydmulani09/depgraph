import type { ViolationResult } from './api-client'

export interface ActionSummary {
  ecosystem: string
  manifestPath: string
  totalPackagesScanned: number
  blockCount: number
  warnCount: number
  approvalCount: number
  passCount: number
  runUrl: string
}

export function formatPRComment(violations: ViolationResult[], summary: ActionSummary): string {
  const lines: string[] = []

  lines.push('## 🔍 depgraph dependency risk scan')
  lines.push('')
  lines.push('| Metric | Value |')
  lines.push('|--------|-------|')
  lines.push(`| Packages scanned | ${summary.totalPackagesScanned} |`)
  lines.push(`| ✅ Clean | ${summary.passCount} |`)
  lines.push(`| ⛔ Block | ${summary.blockCount} |`)
  lines.push(`| ⚠️ Warn | ${summary.warnCount} |`)
  lines.push(`| 🔐 Requires approval | ${summary.approvalCount} |`)
  lines.push('')

  const blockViolations = violations.filter((v) => v.action === 'block')
  const warnViolations = violations.filter((v) => v.action === 'warn')

  if (blockViolations.length > 0) {
    lines.push('### ⛔ Blocking violations')
    lines.push('')
    lines.push('| Package | Rule | Remediation |')
    lines.push('|---------|------|-------------|')
    for (const v of blockViolations) {
      lines.push(`| \`${v.packageName}\` | ${v.ruleName} | ${v.remediation} |`)
    }
    lines.push('')
  }

  if (warnViolations.length > 0) {
    lines.push('### ⚠️ Warnings')
    lines.push('')
    lines.push('| Package | Rule | Score |')
    lines.push('|---------|------|-------|')
    for (const v of warnViolations) {
      lines.push(`| \`${v.packageName}\` | ${v.ruleName} | ${v.compositeScore.toFixed(1)} |`)
    }
    lines.push('')
  }

  if (blockViolations.length === 0 && warnViolations.length === 0) {
    lines.push(
      '✅ **No policy violations found.** All dependencies are within acceptable risk thresholds.'
    )
    lines.push('')
  }

  lines.push(
    `<sub>Scanned ${summary.manifestPath} (${summary.ecosystem}) · [View full report](${summary.runUrl})</sub>`
  )

  return lines.join('\n')
}
