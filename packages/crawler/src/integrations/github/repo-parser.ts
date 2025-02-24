export function parseGitHubRepoUrl(
  url: string | null | undefined
): { owner: string; repo: string } | null {
  if (!url || typeof url !== 'string') return null

  let s = url.trim()
  if (!s) return null

  // Strip git+ prefix
  s = s.replace(/^git\+/, '')

  // git@github.com:owner/repo.git
  const sshMatch = s.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] }

  // github:owner/repo
  if (s.startsWith('github:')) {
    const rest = s.slice('github:'.length)
    return splitOwnerRepo(rest)
  }

  // git:// → convert to https for further parsing
  s = s.replace(/^git:\/\//, 'https://')

  // Full https://github.com/owner/repo[.git]
  const httpsMatch = s.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/)
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] }

  // Non-github URLs
  if (s.includes('://') || s.includes('@')) return null

  // Bare owner/repo shorthand — exactly two segments
  return splitOwnerRepo(s)
}

function splitOwnerRepo(s: string): { owner: string; repo: string } | null {
  // Strip .git suffix
  s = s.replace(/\.git$/, '')
  const parts = s.split('/')
  if (parts.length !== 2) return null
  const [owner, repo] = parts
  if (!owner || !repo || owner.includes('/') || repo.includes('/')) return null
  return { owner, repo }
}
