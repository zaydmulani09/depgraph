// NOTE: ^ caret semantics differ between npm (<1.0) and Cargo (<1.0).
// Simplified: both treat ^ as "next major" regardless of version.
// This is a known simplification — a full implementation would use
// npm's semver library for exact npm ^ semantics.

import { parseCargoVersionReq } from '../registries/cargo/version-req'
import type { Ecosystem, NormalizedRange } from './adapter'

const WILDCARD: Omit<NormalizedRange, 'raw'> = {
  lower: null,
  lowerInclusive: false,
  upper: null,
  upperInclusive: false,
  isWildcard: true,
  canonical: '*',
}

function fallback(raw: string): NormalizedRange {
  return { raw, lower: null, lowerInclusive: false, upper: null, upperInclusive: false, isWildcard: false, canonical: raw }
}

function padToThree(vstr: string): string {
  const parts = vstr.split('.')
  while (parts.length < 3) parts.push('0')
  return parts.join('.')
}

function normalizeNpmRange(range: string): NormalizedRange {
  const raw = range.trim()

  if (!raw || raw === '*' || raw === 'x') {
    return { raw, ...WILDCARD }
  }

  // ^ caret → next major
  if (raw.startsWith('^')) {
    const vstr = raw.slice(1).trim()
    const parts = vstr.split('.').map((s) => parseInt(s, 10) || 0)
    const [major = 0, minor = 0, patch = 0] = parts
    const lower = `${major}.${minor}.${patch}`
    const upper = `${major + 1}.0.0`
    return { raw, lower, lowerInclusive: true, upper, upperInclusive: false, isWildcard: false, canonical: `>=${lower} <${upper}` }
  }

  // ~ tilde → next minor if minor present, else next major
  if (raw.startsWith('~')) {
    const vstr = raw.slice(1).trim()
    const parts = vstr.split('.').map((s) => parseInt(s, 10) || 0)
    const [major = 0, minor = 0, patch = 0] = parts
    const lower = `${major}.${minor}.${patch}`
    const upper = parts.length >= 2 ? `${major}.${minor + 1}.0` : `${major + 1}.0.0`
    return { raw, lower, lowerInclusive: true, upper, upperInclusive: false, isWildcard: false, canonical: `>=${lower} <${upper}` }
  }

  // Space-separated compound: >=1.0.0 <2.0.0
  {
    let lower: string | null = null
    let lowerInclusive = false
    let upper: string | null = null
    let upperInclusive = false
    let matched = false

    for (const part of raw.split(/\s+/)) {
      const m = part.match(/^(>=|>|<=|<|=)([\d.]+(?:-[\w.]+)?)$/)
      if (!m) continue
      matched = true
      const op = m[1], v = m[2]
      if (op === '>=' || op === '>') { lower = v; lowerInclusive = op === '>=' }
      else if (op === '<=' || op === '<') { upper = v; upperInclusive = op === '<=' }
      else if (op === '=') { lower = upper = v; lowerInclusive = upperInclusive = true }
    }

    if (matched && (lower !== null || upper !== null)) {
      const parts: string[] = []
      if (lower !== null) parts.push(`${lowerInclusive ? '>=' : '>'}${lower}`)
      if (upper !== null) parts.push(`${upperInclusive ? '<=' : '<'}${upper}`)
      return { raw, lower, lowerInclusive, upper, upperInclusive, isWildcard: false, canonical: parts.join(' ') }
    }
  }

  // Exact version (no operator)
  if (/^\d+(\.\d+)*$/.test(raw)) {
    return { raw, lower: raw, lowerInclusive: true, upper: raw, upperInclusive: true, isWildcard: false, canonical: `==${raw}` }
  }

  return fallback(raw)
}

function normalizePypiRange(range: string): NormalizedRange {
  const raw = range.trim()

  if (!raw || raw === '*') {
    return { raw, ...WILDCARD }
  }

  // ~= compatible release: ~=1.4 → >=1.4, <2.0; ~=1.4.2 → >=1.4.2, <1.5.0
  const compatMatch = raw.match(/^~=\s*([\d.]+)$/)
  if (compatMatch) {
    const vstr = compatMatch[1]
    const lower = vstr
    const parts = vstr.split('.')
    const truncated = parts.slice(0, -1)
    truncated[truncated.length - 1] = String(parseInt(truncated[truncated.length - 1] ?? '0', 10) + 1)
    const upper = truncated.join('.') + '.0'
    return { raw, lower, lowerInclusive: true, upper, upperInclusive: false, isWildcard: false, canonical: `>=${lower}, <${upper}` }
  }

  // == exact
  const exactMatch = raw.match(/^==\s*([\d.*]+)$/)
  if (exactMatch) {
    const v = exactMatch[1]
    if (v.includes('*')) return { raw, ...WILDCARD }
    return { raw, lower: v, lowerInclusive: true, upper: v, upperInclusive: true, isWildcard: false, canonical: `==${v}` }
  }

  // != exclusion — can't represent as range
  if (raw.startsWith('!=')) {
    return fallback(raw)
  }

  // Comma-separated compound: >=1.0,<2.0
  let lower: string | null = null
  let lowerInclusive = false
  let upper: string | null = null
  let upperInclusive = false
  let matched = false

  for (const part of raw.split(',')) {
    const m = part.trim().match(/^(>=|>|<=|<|==)\s*([\d.]+)$/)
    if (!m) continue
    matched = true
    const op = m[1], v = m[2]
    if (op === '>=' || op === '>') { lower = v; lowerInclusive = op === '>=' }
    else if (op === '<=' || op === '<') { upper = v; upperInclusive = op === '<=' }
    else if (op === '==') { lower = upper = v; lowerInclusive = upperInclusive = true }
  }

  if (matched && (lower !== null || upper !== null)) {
    const parts: string[] = []
    if (lower !== null) parts.push(`${lowerInclusive ? '>=' : '>'}${lower}`)
    if (upper !== null) parts.push(`${upperInclusive ? '<=' : '<'}${upper}`)
    return { raw, lower, lowerInclusive, upper, upperInclusive, isWildcard: false, canonical: parts.join(', ') }
  }

  return fallback(raw)
}

function normalizeCargoRange(range: string): NormalizedRange {
  const raw = range.trim()

  if (!raw || raw === '*') {
    return { raw, ...WILDCARD }
  }

  const parsed = parseCargoVersionReq(raw)

  if (parsed.constraints.length === 1) {
    const c = parsed.constraints[0]

    if (c.operator === '*') {
      return { raw, ...WILDCARD }
    }

    if (c.operator === '^') {
      const major = c.major ?? 0
      const minor = c.minor ?? 0
      const patch = c.patch ?? 0
      const lower = `${major}.${minor}.${patch}`
      const upper = `${major + 1}.0.0`
      return { raw, lower, lowerInclusive: true, upper, upperInclusive: false, isWildcard: false, canonical: `>=${lower} <${upper}` }
    }

    if (c.operator === '~') {
      const major = c.major ?? 0
      const minor = c.minor ?? 0
      const patch = c.patch ?? 0
      const lower = `${major}.${minor}.${patch}`
      const upper = c.minor !== null ? `${major}.${minor + 1}.0` : `${major + 1}.0.0`
      return { raw, lower, lowerInclusive: true, upper, upperInclusive: false, isWildcard: false, canonical: `>=${lower} <${upper}` }
    }

    if (c.operator === '=') {
      const v = padToThree(`${c.major ?? 0}.${c.minor ?? 0}.${c.patch ?? 0}`)
      return { raw, lower: v, lowerInclusive: true, upper: v, upperInclusive: true, isWildcard: false, canonical: `==${v}` }
    }

    const v = `${c.major ?? 0}.${c.minor ?? 0}.${c.patch ?? 0}`
    if (c.operator === '>=') return { raw, lower: v, lowerInclusive: true, upper: null, upperInclusive: false, isWildcard: false, canonical: `>=${v}` }
    if (c.operator === '>') return { raw, lower: v, lowerInclusive: false, upper: null, upperInclusive: false, isWildcard: false, canonical: `>${v}` }
    if (c.operator === '<=') return { raw, lower: null, lowerInclusive: false, upper: v, upperInclusive: true, isWildcard: false, canonical: `<=${v}` }
    if (c.operator === '<') return { raw, lower: null, lowerInclusive: false, upper: v, upperInclusive: false, isWildcard: false, canonical: `<${v}` }
  }

  // Multi-constraint
  let lower: string | null = null
  let lowerInclusive = false
  let upper: string | null = null
  let upperInclusive = false

  for (const c of parsed.constraints) {
    const v = `${c.major ?? 0}.${c.minor ?? 0}.${c.patch ?? 0}`
    if (c.operator === '>=' || c.operator === '>') { lower = v; lowerInclusive = c.operator === '>=' }
    else if (c.operator === '<=' || c.operator === '<') { upper = v; upperInclusive = c.operator === '<=' }
  }

  if (lower !== null || upper !== null) {
    const parts: string[] = []
    if (lower !== null) parts.push(`${lowerInclusive ? '>=' : '>'}${lower}`)
    if (upper !== null) parts.push(`${upperInclusive ? '<=' : '<'}${upper}`)
    return { raw, lower, lowerInclusive, upper, upperInclusive, isWildcard: false, canonical: parts.join(' ') }
  }

  return fallback(raw)
}

export function normalizeRange(range: string, ecosystem: Ecosystem): NormalizedRange {
  switch (ecosystem) {
    case 'npm': return normalizeNpmRange(range)
    case 'pypi': return normalizePypiRange(range)
    case 'cargo': return normalizeCargoRange(range)
  }
}
