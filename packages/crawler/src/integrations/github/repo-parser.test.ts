import { describe, it, expect } from 'vitest'
import { parseGitHubRepoUrl } from './repo-parser'

describe('parseGitHubRepoUrl', () => {
  // Standard https
  it('parses https://github.com/owner/repo', () => {
    expect(parseGitHubRepoUrl('https://github.com/owner/repo')).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('parses https://github.com/owner/repo.git', () => {
    expect(parseGitHubRepoUrl('https://github.com/owner/repo.git')).toEqual({ owner: 'owner', repo: 'repo' })
  })

  // git+ prefix
  it('parses git+https://github.com/owner/repo.git', () => {
    expect(parseGitHubRepoUrl('git+https://github.com/owner/repo.git')).toEqual({ owner: 'owner', repo: 'repo' })
  })

  // git:// protocol
  it('parses git://github.com/owner/repo.git', () => {
    expect(parseGitHubRepoUrl('git://github.com/owner/repo.git')).toEqual({ owner: 'owner', repo: 'repo' })
  })

  // SSH format
  it('parses git@github.com:owner/repo.git', () => {
    expect(parseGitHubRepoUrl('git@github.com:owner/repo.git')).toEqual({ owner: 'owner', repo: 'repo' })
  })

  // github: shorthand
  it('parses github:owner/repo', () => {
    expect(parseGitHubRepoUrl('github:owner/repo')).toEqual({ owner: 'owner', repo: 'repo' })
  })

  // Bare shorthand
  it('parses bare owner/repo shorthand', () => {
    expect(parseGitHubRepoUrl('owner/myrepo')).toEqual({ owner: 'owner', repo: 'myrepo' })
  })

  // Orgs with hyphens and dots
  it('handles org names with hyphens', () => {
    expect(parseGitHubRepoUrl('https://github.com/my-org/my-repo')).toEqual({ owner: 'my-org', repo: 'my-repo' })
  })

  // Null / empty / undefined
  it('returns null for null', () => {
    expect(parseGitHubRepoUrl(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(parseGitHubRepoUrl(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseGitHubRepoUrl('')).toBeNull()
  })

  // Non-github URL
  it('returns null for gitlab URL', () => {
    expect(parseGitHubRepoUrl('https://gitlab.com/owner/repo')).toBeNull()
  })

  // Too many segments
  it('returns null for URL with too many path segments', () => {
    expect(parseGitHubRepoUrl('https://github.com/owner/repo/extra')).toBeNull()
  })

  // Trailing slash handled
  it('handles trailing slash in https URL', () => {
    expect(parseGitHubRepoUrl('https://github.com/owner/repo/')).toEqual({ owner: 'owner', repo: 'repo' })
  })
})
