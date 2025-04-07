export interface Pep440Version {
  epoch: number
  release: number[]
  pre: { type: 'a' | 'b' | 'rc'; n: number } | null
  post: number | null
  dev: number | null
  local: string | null
  raw: string
}

export function parsePep440(version: string): Pep440Version | null {
  const v = version.trim()
  if (!v) return null

  let rest = v
  let epoch = 0
  let pre: Pep440Version['pre'] = null
  let post: number | null = null
  let dev: number | null = null
  let local: string | null = null

  // Local version segment
  const localIdx = rest.indexOf('+')
  if (localIdx !== -1) {
    local = rest.slice(localIdx + 1)
    rest = rest.slice(0, localIdx)
  }

  // Epoch: N!
  const epochMatch = rest.match(/^(\d+)!(.+)$/)
  if (epochMatch) {
    epoch = parseInt(epochMatch[1], 10)
    rest = epochMatch[2]
  }

  // Dev: .devN or _devN
  const devMatch = rest.match(/[._-]dev(\d+)$/i)
  if (devMatch) {
    dev = parseInt(devMatch[1], 10)
    rest = rest.slice(0, rest.length - devMatch[0].length)
  }

  // Post: .postN or -N (implicit post)
  const postMatch = rest.match(/[._]post(\d+)$/i) ?? rest.match(/-(\d+)$/)
  if (postMatch) {
    post = parseInt(postMatch[1], 10)
    rest = rest.slice(0, rest.length - postMatch[0].length)
  }

  // Pre-release: (a|alpha|b|beta|rc|c)N with optional separator
  const preMatch = rest.match(/[._-]?(alpha|beta|a|b|rc|c)\.?(\d+)$/i)
  if (preMatch) {
    let type = preMatch[1].toLowerCase()
    if (type === 'alpha') type = 'a'
    else if (type === 'beta') type = 'b'
    else if (type === 'c') type = 'rc'
    pre = { type: type as 'a' | 'b' | 'rc', n: parseInt(preMatch[2], 10) }
    rest = rest.slice(0, rest.length - preMatch[0].length)
  }

  // Release: dot-separated integers
  if (!rest) return null
  const releaseParts = rest.split('.').map((s) => parseInt(s, 10))
  if (releaseParts.length === 0 || releaseParts.some((n) => isNaN(n))) return null

  return { epoch, release: releaseParts, pre, post, dev, local, raw: version }
}

export function isStableRelease(v: Pep440Version): boolean {
  return v.pre === null && v.dev === null
}

export function comparePep440(a: Pep440Version, b: Pep440Version): number {
  if (a.epoch !== b.epoch) return a.epoch - b.epoch

  const maxLen = Math.max(a.release.length, b.release.length)
  for (let i = 0; i < maxLen; i++) {
    const av = a.release[i] ?? 0
    const bv = b.release[i] ?? 0
    if (av !== bv) return av - bv
  }

  // Pre-release < release
  if (a.pre !== null && b.pre === null) return -1
  if (a.pre === null && b.pre !== null) return 1
  if (a.pre !== null && b.pre !== null) {
    const typeOrder = { a: 0, b: 1, rc: 2 }
    const at = typeOrder[a.pre.type]
    const bt = typeOrder[b.pre.type]
    if (at !== bt) return at - bt
    if (a.pre.n !== b.pre.n) return a.pre.n - b.pre.n
  }

  // Dev < no-dev
  if (a.dev !== null && b.dev === null) return -1
  if (a.dev === null && b.dev !== null) return 1
  if (a.dev !== null && b.dev !== null && a.dev !== b.dev) return a.dev - b.dev

  // No-post < post
  if (a.post === null && b.post !== null) return -1
  if (a.post !== null && b.post === null) return 1
  if (a.post !== null && b.post !== null && a.post !== b.post) return a.post - b.post

  return 0
}
