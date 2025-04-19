import * as core from '@actions/core'
import * as github from '@actions/github'
import { parseManifest } from './manifest-parser'
import { createApiClient } from './api-client'
import type { ViolationResult } from './api-client'
import { formatPRComment } from './comment-formatter'
import type { ActionSummary } from './comment-formatter'
import { resolveExitCode, EXIT_BLOCK, EXIT_WARN } from './exit-codes'

async function run(): Promise<void> {
  const apiUrl = core.getInput('api-url', { required: true })
  const apiKey = core.getInput('api-key', { required: true })
  const manifestPath = core.getInput('manifest-path') || 'package.json'
  const ecosystem = (core.getInput('ecosystem') || 'npm') as 'npm' | 'pypi' | 'cargo'
  const failOn = (core.getInput('fail-on') || 'block') as 'block' | 'warn' | 'require_approval'
  const postComment = core.getInput('post-comment') !== 'false'
  const githubToken = core.getInput('github-token')

  core.info(`[depgraph] Scanning ${manifestPath} (${ecosystem})`)

  const manifest = await parseManifest(manifestPath, ecosystem)
  core.info(`[depgraph] Found ${manifest.dependencies.length} dependencies`)

  const client = createApiClient({ apiUrl, apiKey })
  const packages = manifest.dependencies.map((d) => ({
    name: d.name,
    ecosystem,
    version: d.versionRange,
  }))

  let violations: ViolationResult[] = []
  try {
    violations = await client.evaluatePackages(packages)
  } catch (error) {
    core.warning(`[depgraph] API call failed: ${error}. Continuing without scan results.`)
  }

  const blockViolations = violations.filter((v) => v.action === 'block')
  const warnViolations = violations.filter((v) => v.action === 'warn')
  const approvalViolations = violations.filter((v) => v.action === 'require_approval')

  const summary: ActionSummary = {
    ecosystem,
    manifestPath,
    totalPackagesScanned: manifest.dependencies.length,
    blockCount: blockViolations.length,
    warnCount: warnViolations.length,
    approvalCount: approvalViolations.length,
    passCount: Math.max(0, manifest.dependencies.length - violations.length),
    runUrl: `${process.env['GITHUB_SERVER_URL'] ?? 'https://github.com'}/${process.env['GITHUB_REPOSITORY'] ?? ''}/actions/runs/${process.env['GITHUB_RUN_ID'] ?? ''}`,
  }

  core.info(
    `[depgraph] Scan complete: ${blockViolations.length} block, ${warnViolations.length} warn, ${approvalViolations.length} require_approval`
  )

  for (const v of blockViolations) {
    core.error(`BLOCK: ${v.packageName} — ${v.ruleName}: ${v.remediation}`)
  }
  for (const v of warnViolations) {
    core.warning(`WARN: ${v.packageName} — ${v.ruleName}`)
  }

  core.setOutput('violations-found', violations.length.toString())
  core.setOutput('block-count', blockViolations.length.toString())
  core.setOutput('warn-count', warnViolations.length.toString())
  core.setOutput('risk-summary', JSON.stringify(summary))

  if (postComment && github.context.eventName === 'pull_request') {
    try {
      const octokit = github.getOctokit(githubToken)
      const { owner, repo } = github.context.repo
      const prNumber = (github.context.payload as { pull_request?: { number: number } })
        .pull_request?.number

      if (prNumber) {
        const comment = formatPRComment(violations, summary)
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: comment,
        })
        core.info('[depgraph] Posted PR comment')
      }
    } catch (error) {
      core.warning(`[depgraph] Failed to post PR comment: ${error}`)
    }
  }

  await core.summary
    .addHeading('depgraph Dependency Risk Scan')
    .addTable([
      [
        { data: 'Metric', header: true },
        { data: 'Value', header: true },
      ],
      ['Packages scanned', summary.totalPackagesScanned.toString()],
      ['Block violations', summary.blockCount.toString()],
      ['Warn violations', summary.warnCount.toString()],
      ['Requires approval', summary.approvalCount.toString()],
    ])
    .write()

  const exitCode = resolveExitCode(violations, failOn)
  if (exitCode === EXIT_BLOCK) {
    core.setFailed(`depgraph: ${blockViolations.length} blocking policy violation(s) found`)
  } else if (exitCode === EXIT_WARN) {
    core.warning(`depgraph: ${warnViolations.length} warning(s) found`)
  }
}

run().catch(core.setFailed)
